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
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

const day = (date: Date) => date.toISOString().slice(0, 10)

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
	const current = fns.start(new Date())
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
		income: number
		expense: number
		count: number
		/** Saídas por tag; uma transação com duas tags conta nas duas */
		byTag: Record<string, number>
		/** Saídas sem tag */
		untagged: number
		/** Entradas e saídas fora dos totais (transferências entre contas e afins) */
		excludedIn: number
		excludedOut: number
	}[] = []
	const index = new Map<string, number>()

	for (let start = rangeStart; start <= current; start = fns.add(start, 1)) {
		index.set(day(start), periods.length)
		periods.push({
			start: day(start),
			end: day(fns.end(start)),
			income: 0,
			expense: 0,
			count: 0,
			byTag: {},
			untagged: 0,
			excludedIn: 0,
			excludedOut: 0,
		})
	}

	for (const tx of transactions) {
		const period = periods[index.get(day(fns.start(tx.date))) ?? -1]
		if (!period) continue

		const amount = Number(tx.amount)

		// Dinheiro passando entre contas próprias não é entrada nem gasto
		if (tx.tags.some(({ tag }) => tag.excludeFromTotals)) {
			if (amount > 0) period.excludedIn += amount
			else period.excludedOut += amount
			continue
		}

		period.count++
		if (amount > 0) {
			period.income += amount
			continue
		}

		period.expense += amount
		if (tx.tags.length === 0) period.untagged += amount
		for (const { tagId } of tx.tags) period.byTag[tagId] = (period.byTag[tagId] ?? 0) + amount
	}

	// Soma em float acumula erro de centavos
	const round = (value: number) => Math.round(value * 100) / 100

	return NextResponse.json({
		granularity,
		periods: periods.map((period) => ({
			...period,
			income: round(period.income),
			expense: round(period.expense),
			untagged: round(period.untagged),
			excludedIn: round(period.excludedIn),
			excludedOut: round(period.excludedOut),
			byTag: Object.fromEntries(
				Object.entries(period.byTag).map(([tagId, value]) => [tagId, round(value)]),
			),
		})),
	})
}
