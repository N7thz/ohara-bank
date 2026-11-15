import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { absMoney, add, type Money, toMoney, toReais, zeroMoney } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { COUNTS_IN_TOTALS } from '@/lib/tags'
import {
	searchParamsObject,
	transactionFiltersSchema,
	transactionWhere,
} from '@/lib/transaction-filters'

// Sem filtro de mês, só os últimos meses com dados
const MAX_MONTHS = 12

// Saídas que contam nos totais, somadas por dia: alimenta o calendário de calor e o gasto por dia da semana
export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	// O tipo não vale aqui: são sempre as saídas
	const query = transactionFiltersSchema.omit({ type: true }).safeParse(searchParamsObject(request))
	if (!query.success) {
		return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })
	}

	const { base } = transactionWhere(session.user.id, query.data)
	const filter = { AND: [base, COUNTS_IN_TOTALS, { amount: { lt: 0 } }] }

	let since: Date | undefined
	if (!query.data.month) {
		const latest = await prisma.transaction.aggregate({ where: filter, _max: { date: true } })
		if (latest._max.date) {
			const { date } = latest._max
			since = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - (MAX_MONTHS - 1), 1))
		}
	}

	const transactions = await prisma.transaction.findMany({
		where: since ? { AND: [filter, { date: { gte: since } }] } : filter,
		select: { date: true, amount: true },
	})

	const days = new Map<string, { total: Money; count: number }>()
	for (const tx of transactions) {
		const key = tx.date.toISOString().slice(0, 10)
		const day = days.get(key) ?? { total: zeroMoney(), count: 0 }
		// Saída como magnitude
		day.total = add(day.total, absMoney(toMoney(tx.amount)))
		day.count++
		days.set(key, day)
	}

	return NextResponse.json(
		[...days]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, day]) => ({ date, total: toReais(day.total), count: day.count })),
	)
}
