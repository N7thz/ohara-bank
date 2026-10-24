import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getInstallmentLabels } from '@/lib/debts/installments'
import { prisma } from '@/lib/prisma'
import { COUNTS_IN_TOTALS, EXCLUDED_FROM_TOTALS } from '@/lib/tags'
import type { Prisma } from '../../../../../prisma/generated/client'

const querySchema = z.object({
	accountId: z.string().optional(),
	/** AAAA-MM */
	month: z
		.string()
		.regex(/^\d{4}-(0[1-9]|1[0-2])$/)
		.optional(),
	type: z.enum(['income', 'expense']).optional(),
	q: z.string().trim().max(100).optional(),
	/** Id da tag, ou "none" para transações sem tag */
	tagId: z.string().optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export async function GET(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const params = Object.fromEntries(
		[...new URL(request.url).searchParams].filter(([, value]) => value !== ''),
	)
	const query = querySchema.safeParse(params)
	if (!query.success) {
		return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })
	}

	const { accountId, month, type, q, tagId, page, pageSize } = query.data
	const userId = session.user.id

	// Datas são gravadas à meia-noite UTC, então o mês vai de dia 1 até o dia 1 seguinte
	let date: Prisma.DateTimeFilter | undefined
	if (month) {
		const [year, monthIndex] = month.split('-').map(Number)
		date = {
			gte: new Date(Date.UTC(year, monthIndex - 1, 1)),
			lt: new Date(Date.UTC(year, monthIndex, 1)),
		}
	}

	// Conta e busca valem para tudo, inclusive o histórico mensal
	const allMonths: Prisma.TransactionWhereInput = {
		account: { userId },
		...(accountId && { accountId }),
		...(q && { description: { contains: q, mode: 'insensitive' } }),
	}
	// O período vale para tudo menos o histórico mensal, inclusive o agrupamento por tag
	const scope: Prisma.TransactionWhereInput = { ...allMonths, ...(date && { date }) }
	// A tag filtra lista, totais e histórico; o tipo só filtra a lista
	const tagFilter: Prisma.TransactionWhereInput = {
		...(tagId === 'none' && { tags: { none: {} } }),
		...(tagId && tagId !== 'none' && { tags: { some: { tagId } } }),
	}
	const base: Prisma.TransactionWhereInput = { ...scope, ...tagFilter }
	const where: Prisma.TransactionWhereInput = {
		...base,
		...(type === 'income' && { amount: { gt: 0 } }),
		...(type === 'expense' && { amount: { lt: 0 } }),
	}

	const [
		transactions,
		total,
		income,
		expense,
		excluded,
		months,
		tagLinks,
		untagged,
		history,
		installments,
		tagCounts,
	] = await Promise.all([
		prisma.transaction.findMany({
			where,
			orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
			skip: (page - 1) * pageSize,
			take: pageSize,
			include: {
				account: { select: { bankName: true, number: true, type: true } },
				tags: { select: { tagId: true } },
			},
		}),
		prisma.transaction.count({ where }),
		// Totais sem transferências entre contas (tags "fora dos totais")
		prisma.transaction.aggregate({
			where: { AND: [base, COUNTS_IN_TOTALS, { amount: { gt: 0 } }] },
			_sum: { amount: true },
		}),
		prisma.transaction.aggregate({
			where: { AND: [base, COUNTS_IN_TOTALS, { amount: { lt: 0 } }] },
			_sum: { amount: true },
		}),
		prisma.transaction.aggregate({ where: { AND: [base, EXCLUDED_FROM_TOTALS] }, _count: true }),
		prisma.$queryRaw<{ month: string }[]>`
			SELECT DISTINCT to_char(t.date, 'YYYY-MM') AS month
			FROM "transaction" t
			JOIN bank_account a ON a.id = t."accountId"
			WHERE a."userId" = ${userId}
				-- Só os meses da conta escolhida: os outros dariam lista vazia
				AND (${accountId ?? null}::text IS NULL OR t."accountId" = ${accountId ?? null})
			ORDER BY month DESC
		`,
		prisma.transactionTag.findMany({
			where: { transaction: { AND: [scope, COUNTS_IN_TOTALS] } },
			select: { tagId: true, transaction: { select: { amount: true } } },
		}),
		prisma.transaction.aggregate({
			where: { ...scope, tags: { none: {} }, amount: { lt: 0 } },
			_sum: { amount: true },
			_count: true,
		}),
		prisma.transaction.findMany({
			where: { AND: [allMonths, tagFilter, COUNTS_IN_TOTALS] },
			select: { date: true, amount: true },
		}),
		getInstallmentLabels(userId),
		// Transações por tag com conta, período e busca: o filtro de tag só oferece o que existe
		prisma.transactionTag.groupBy({
			by: ['tagId'],
			where: { transaction: scope },
			_count: true,
		}),
	])

	// Uma transação com duas tags conta nas duas
	const byTag = new Map<string, { income: number; expense: number; expenseCount: number }>()
	for (const { tagId: id, transaction } of tagLinks) {
		const amount = Number(transaction.amount)
		const group = byTag.get(id) ?? { income: 0, expense: 0, expenseCount: 0 }
		if (amount > 0) group.income += amount
		else {
			group.expense += amount
			group.expenseCount++
		}
		byTag.set(id, group)
	}

	// Entradas e saídas por mês, do primeiro ao último mês com transações, sem buracos
	const monthTotals = new Map<string, { income: number; expense: number }>()
	for (const tx of history) {
		const key = tx.date.toISOString().slice(0, 7)
		const amount = Number(tx.amount)
		const totals = monthTotals.get(key) ?? { income: 0, expense: 0 }
		if (amount > 0) totals.income += amount
		else totals.expense += amount
		monthTotals.set(key, totals)
	}
	const byMonth: { start: string; end: string; income: number; expense: number }[] = []
	const keys = [...monthTotals.keys()].sort()
	if (keys.length > 0) {
		const [firstYear, firstMonth] = keys[0].split('-').map(Number)
		const last = keys.at(-1) as string
		for (let index = firstMonth - 1; ; index++) {
			const start = new Date(Date.UTC(firstYear, index, 1))
			const key = start.toISOString().slice(0, 7)
			if (key > last) break
			const totals = monthTotals.get(key) ?? { income: 0, expense: 0 }
			byMonth.push({
				start: start.toISOString().slice(0, 10),
				end: new Date(Date.UTC(firstYear, index + 1, 0)).toISOString().slice(0, 10),
				// Soma em float acumula erro de centavos
				income: Math.round(totals.income * 100) / 100,
				expense: Math.round(totals.expense * 100) / 100,
			})
		}
	}

	return NextResponse.json({
		transactions: transactions.map(({ amount, account, tags, ...tx }) => ({
			...tx,
			amount: Number(amount),
			account,
			tagIds: tags.map((tag) => tag.tagId),
			/** Parcela da dívida parcelada que esta transação paga */
			installment: installments.get(tx.id) ?? null,
		})),
		total,
		page,
		pageSize,
		summary: {
			income: Number(income._sum.amount ?? 0),
			expense: Number(expense._sum.amount ?? 0),
			/** Transações que ficaram fora das somas acima */
			excludedCount: excluded._count,
		},
		months: months.map((row) => row.month),
		byTag: [...byTag].map(([id, group]) => ({ tagId: id, ...group })),
		// Saídas sem nenhuma tag
		untagged: { expense: Number(untagged._sum.amount ?? 0), count: untagged._count },
		byMonth,
		/** Quantas transações cada tag tem com conta, período e busca (inclui as fora dos totais) */
		tagCounts: Object.fromEntries(tagCounts.map((row) => [row.tagId, row._count])),
	})
}
