import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/api-session'
import { absMoney, add, type Money, toMoney, toReais, zeroMoney } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { COUNTS_IN_TOTALS } from '@/lib/tags'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const querySchema = z.object({
	/** Período escolhido, AAAA-MM-DD inclusive */
	start: day,
	end: day,
	/** Começo do período anterior, que termina na véspera de start */
	previousStart: day.optional(),
	accountId: z.string().optional(),
})

export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const params = Object.fromEntries(
		[...new URL(request.url).searchParams].filter(([, value]) => value !== ''),
	)
	const query = querySchema.safeParse(params)
	if (!query.success) {
		return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })
	}

	const { start, end, previousStart, accountId } = query.data
	// Datas são gravadas à meia-noite UTC: o período vai até o começo do dia seguinte
	const startDate = new Date(`${start}T00:00:00Z`)
	const endDate = new Date(`${end}T00:00:00Z`)
	endDate.setUTCDate(endDate.getUTCDate() + 1)

	const owner = { account: { userId: session.user.id }, ...(accountId && { accountId }) }

	const [transactions, last] = await Promise.all([
		prisma.transaction.findMany({
			where: {
				AND: [
					owner,
					{ date: { gte: new Date(`${previousStart ?? start}T00:00:00Z`), lt: endDate } },
					{ amount: { lt: 0 } },
					COUNTS_IN_TOTALS,
				],
			},
			select: { date: true, amount: true },
		}),
		// Último dia com extrato (qualquer transação): depois dele não há dado, não gasto zero
		prisma.transaction.findFirst({
			where: owner,
			orderBy: { date: 'desc' },
			select: { date: true },
		}),
	])

	const current = new Map<string, Money>()
	const previous = new Map<string, Money>()

	for (const tx of transactions) {
		const key = tx.date.toISOString().slice(0, 10)
		const target = tx.date < startDate ? previous : current
		target.set(key, add(target.get(key) ?? zeroMoney(), absMoney(toMoney(tx.amount))))
	}

	// Só os dias com gasto; o cliente completa os dias vazios com zero
	const toList = (map: Map<string, Money>) =>
		[...map]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, total]) => ({ date, total: toReais(total) }))

	return NextResponse.json({
		current: toList(current),
		previous: previousStart ? toList(previous) : null,
		lastStatementDate: last?.date.toISOString().slice(0, 10) ?? null,
	})
}
