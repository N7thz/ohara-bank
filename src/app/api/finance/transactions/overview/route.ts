import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { monthKey } from '@/lib/dates'
import { add, isPositive, type Money, toMoney, toReais, zeroMoney } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { COUNTS_IN_TOTALS } from '@/lib/tags'
import {
	searchParamsObject,
	transactionFiltersSchema,
	transactionWhere,
} from '@/lib/transaction-filters'

/** O que não depende da página da lista: meses, gastos por tag, evolução por mês e contagens */
export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const query = transactionFiltersSchema.safeParse(searchParamsObject(request))
	if (!query.success) {
		return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })
	}

	const { accountId } = query.data
	const userId = session.user.id
	const { allMonths, scope, tagFilter } = transactionWhere(userId, query.data)

	const [months, tagLinks, untagged, history, tagCounts] = await Promise.all([
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
		// Transações por tag com conta, período e busca: o filtro de tag só oferece o que existe
		prisma.transactionTag.groupBy({
			by: ['tagId'],
			where: { transaction: scope },
			_count: true,
		}),
	])

	// Uma transação com duas tags conta nas duas
	const byTag = new Map<string, { income: Money; expense: Money; expenseCount: number }>()
	for (const { tagId: id, transaction } of tagLinks) {
		const amount = toMoney(transaction.amount)
		const group = byTag.get(id) ?? { income: zeroMoney(), expense: zeroMoney(), expenseCount: 0 }
		if (isPositive(amount)) group.income = add(group.income, amount)
		else {
			group.expense = add(group.expense, amount)
			group.expenseCount++
		}
		byTag.set(id, group)
	}

	// Entradas e saídas por mês, do primeiro ao último mês com transações, sem buracos
	const monthTotals = new Map<string, { income: Money; expense: Money }>()
	for (const tx of history) {
		const key = monthKey(tx.date)
		const amount = toMoney(tx.amount)
		const totals = monthTotals.get(key) ?? { income: zeroMoney(), expense: zeroMoney() }
		if (isPositive(amount)) totals.income = add(totals.income, amount)
		else totals.expense = add(totals.expense, amount)
		monthTotals.set(key, totals)
	}
	const byMonth: { start: string; end: string; income: number; expense: number }[] = []
	const keys = [...monthTotals.keys()].sort()
	if (keys.length > 0) {
		const [firstYear, firstMonth] = keys[0].split('-').map(Number)
		const last = keys.at(-1) as string
		for (let index = firstMonth - 1; ; index++) {
			const start = new Date(Date.UTC(firstYear, index, 1))
			const key = monthKey(start)
			if (key > last) break
			const totals = monthTotals.get(key) ?? { income: zeroMoney(), expense: zeroMoney() }
			byMonth.push({
				start: start.toISOString().slice(0, 10),
				end: new Date(Date.UTC(firstYear, index + 1, 0)).toISOString().slice(0, 10),
				income: toReais(totals.income),
				expense: toReais(totals.expense),
			})
		}
	}

	return NextResponse.json({
		months: months.map((row) => row.month),
		byTag: [...byTag].map(([id, group]) => ({
			tagId: id,
			income: toReais(group.income),
			expense: toReais(group.expense),
			expenseCount: group.expenseCount,
		})),
		// Saídas sem nenhuma tag
		untagged: { expense: Number(untagged._sum.amount ?? 0), count: untagged._count },
		byMonth,
		/** Quantas transações cada tag tem com conta, período e busca (inclui as fora dos totais) */
		tagCounts: Object.fromEntries(tagCounts.map((row) => [row.tagId, row._count])),
	})
}
