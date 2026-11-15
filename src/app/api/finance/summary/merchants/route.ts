import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/api-session'
import { merchantKey, merchantLabel, merchantName } from '@/lib/merchants'
import {
	absMoney,
	add,
	compare,
	type Money,
	sumMoney,
	toMoney,
	toReais,
	zeroMoney,
} from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { COUNTS_IN_TOTALS } from '@/lib/tags'

// Quantos lugares a lista mostra; o resto vira "outros"
const LIMIT = 8

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

	const transactions = await prisma.transaction.findMany({
		where: {
			AND: [
				{ account: { userId: session.user.id }, ...(accountId && { accountId }) },
				{ date: { gte: new Date(`${previousStart ?? start}T00:00:00Z`), lt: endDate } },
				{ amount: { lt: 0 } },
				COUNTS_IN_TOTALS,
			],
		},
		orderBy: { date: 'desc' },
		select: { date: true, amount: true, description: true, tags: { select: { tagId: true } } },
	})

	const merchants = new Map<
		string,
		{
			name: string
			/** Trecho da descrição para buscar na lista de transações */
			query: string
			total: Money
			count: number
			previous: Money
			tagCounts: Map<string, number>
		}
	>()
	let periodTotal = zeroMoney()

	for (const tx of transactions) {
		const name = merchantName(tx.description)
		const key = merchantKey(name)
		const amount = absMoney(toMoney(tx.amount))
		// Ordem por data decrescente: o nome que fica é o da compra mais recente
		const merchant = merchants.get(key) ?? {
			name: merchantLabel(name),
			query: name,
			total: zeroMoney(),
			count: 0,
			previous: zeroMoney(),
			tagCounts: new Map(),
		}

		if (tx.date < startDate) {
			merchant.previous = add(merchant.previous, amount)
		} else {
			merchant.total = add(merchant.total, amount)
			merchant.count++
			periodTotal = add(periodTotal, amount)
			for (const { tagId } of tx.tags) {
				merchant.tagCounts.set(tagId, (merchant.tagCounts.get(tagId) ?? 0) + 1)
			}
		}
		merchants.set(key, merchant)
	}

	const ranked = [...merchants.values()]
		.filter((merchant) => merchant.count > 0)
		.sort((a, b) => compare(b.total, a.total))
	const top = ranked.slice(0, LIMIT)
	const others = ranked.slice(LIMIT)

	return NextResponse.json({
		total: toReais(periodTotal),
		merchants: top.map(({ tagCounts, ...merchant }) => ({
			...merchant,
			total: toReais(merchant.total),
			previous: previousStart ? toReais(merchant.previous) : null,
			// Tag mais usada nas compras do lugar
			tagId: [...tagCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
		})),
		others: {
			count: others.length,
			total: toReais(sumMoney(others.map((merchant) => merchant.total))),
		},
	})
}
