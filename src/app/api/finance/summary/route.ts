import { UTCDate } from '@date-fns/utc'
import {
	addMonths,
	addWeeks,
	endOfMonth,
	endOfWeek,
	max,
	startOfMonth,
	startOfWeek,
	subMonths,
	subWeeks,
} from 'date-fns'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/api-session'
import { day, localToday } from '@/lib/dates'
import { add, isPositive, type Money, toMoney, toReais, zeroMoney } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { isExcludedFromTotals } from '@/lib/totals'
import { searchParamsObject } from '@/lib/transaction-filters'

// Quantos períodos o resumo mostra, terminando no período atual
const PERIOD_COUNT = 12

const querySchema = z.object({
	granularity: z.enum(['week', 'month']).default('month'),
	accountId: z.string().optional(),
})

// Semana de segunda a domingo; datas em UTC porque as transações são gravadas à meia-noite UTC
const periodFns = {
	week: {
		start: (date: Date) => startOfWeek(new UTCDate(date), { weekStartsOn: 1 }),
		end: (date: Date) => endOfWeek(new UTCDate(date), { weekStartsOn: 1 }),
		add: addWeeks,
		sub: subWeeks,
	},
	month: {
		start: (date: Date) => startOfMonth(new UTCDate(date)),
		end: (date: Date) => endOfMonth(new UTCDate(date)),
		add: addMonths,
		sub: subMonths,
	},
}

export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const query = querySchema.safeParse(searchParamsObject(request))
	if (!query.success) {
		return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })
	}

	const { granularity, accountId } = query.data
	const fns = periodFns[granularity]
	const where = { account: { userId: session.user.id }, ...(accountId && { accountId }) }

	const first = await prisma.transaction.findFirst({
		where,
		orderBy: { date: 'asc' },
		select: { date: true },
	})
	if (!first) {
		return NextResponse.json({ granularity, periods: [] })
	}

	// Últimos 12 períodos até hoje, sem os anteriores à primeira transação
	const current = fns.start(localToday())
	const rangeStart = max([fns.sub(current, PERIOD_COUNT - 1), fns.start(first.date)])

	const transactions = await prisma.transaction.findMany({
		where: { ...where, date: { gte: rangeStart } },
		select: {
			date: true,
			amount: true,
			tags: { select: { tagId: true, tag: { select: { excludeFromTotals: true } } } },
		},
	})

	const periods: {
		start: string
		end: string
		income: Money
		expense: Money
		count: number
		/** Saídas por tag; uma transação com duas tags conta nas duas */
		byTag: Record<string, Money>
		/** Saídas sem tag */
		untagged: Money
		/** Entradas e saídas fora dos totais (transferências entre contas e afins) */
		excludedIn: Money
		excludedOut: Money
	}[] = []
	const index = new Map<string, number>()

	for (let start = rangeStart; start <= current; start = fns.add(start, 1)) {
		index.set(day(start), periods.length)
		periods.push({
			start: day(start),
			end: day(fns.end(start)),
			income: zeroMoney(),
			expense: zeroMoney(),
			count: 0,
			byTag: {},
			untagged: zeroMoney(),
			excludedIn: zeroMoney(),
			excludedOut: zeroMoney(),
		})
	}

	for (const tx of transactions) {
		const period = periods[index.get(day(fns.start(tx.date))) ?? -1]
		if (!period) continue

		const amount = toMoney(tx.amount)

		// Dinheiro passando entre contas próprias não é entrada nem gasto
		if (isExcludedFromTotals(tx.tags)) {
			if (isPositive(amount)) period.excludedIn = add(period.excludedIn, amount)
			else period.excludedOut = add(period.excludedOut, amount)
			continue
		}

		period.count++
		if (isPositive(amount)) {
			period.income = add(period.income, amount)
			continue
		}

		period.expense = add(period.expense, amount)
		if (tx.tags.length === 0) period.untagged = add(period.untagged, amount)
		for (const { tagId } of tx.tags) {
			period.byTag[tagId] = add(period.byTag[tagId] ?? zeroMoney(), amount)
		}
	}

	return NextResponse.json({
		granularity,
		periods: periods.map((period) => ({
			...period,
			income: toReais(period.income),
			expense: toReais(period.expense),
			untagged: toReais(period.untagged),
			excludedIn: toReais(period.excludedIn),
			excludedOut: toReais(period.excludedOut),
			byTag: Object.fromEntries(
				Object.entries(period.byTag).map(([tagId, value]) => [tagId, toReais(value)]),
			),
		})),
	})
}
