import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/api-session'
import { getInstallmentLabels } from '@/lib/debts/installments'
import { prisma } from '@/lib/prisma'
import { COUNTS_IN_TOTALS, EXCLUDED_FROM_TOTALS } from '@/lib/tags'
import {
	searchParamsObject,
	transactionFiltersSchema,
	transactionWhere,
} from '@/lib/transaction-filters'

const querySchema = transactionFiltersSchema.extend({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const query = querySchema.safeParse(searchParamsObject(request))
	if (!query.success) {
		return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })
	}

	const { page, pageSize } = query.data
	const userId = session.user.id
	const { base, where } = transactionWhere(userId, query.data)

	const [transactions, total, income, expense, excluded, installments] = await Promise.all([
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
		getInstallmentLabels(userId),
	])

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
	})
}
