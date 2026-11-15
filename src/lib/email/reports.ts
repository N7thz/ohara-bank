import type { PeriodReport } from '@/emails/period-summary'
import { merchantKey, merchantLabel, merchantName } from '@/lib/merchants'
import {
	absMoney,
	add,
	compare,
	isPositive,
	type Money,
	sumMoney,
	toMoney,
	toReais,
	zeroMoney,
} from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { COUNTS_IN_TOTALS } from '@/lib/tags'
import { isExcludedFromTotals } from '@/lib/totals'

// Números dos e-mails de resumo e de orçamento

/** Entradas, saídas, gastos por tag e lugares onde mais gastou entre start e end (exclusivo) */
export async function periodReport(userId: string, start: Date, end: Date): Promise<PeriodReport> {
	const [transactions, tags] = await Promise.all([
		prisma.transaction.findMany({
			where: { account: { userId }, date: { gte: start, lt: end } },
			select: {
				amount: true,
				description: true,
				tags: { select: { tagId: true, tag: { select: { excludeFromTotals: true } } } },
			},
		}),
		prisma.tag.findMany({ where: { userId }, select: { id: true, name: true } }),
	])

	// Em centavos (dinero.js); vira reais só na saída
	let income = zeroMoney()
	let expense = zeroMoney()
	let count = 0
	const byTag = new Map<string, Money>()
	const merchants = new Map<string, { name: string; total: Money; count: number }>()

	for (const tx of transactions) {
		// Transferência entre contas próprias não é entrada nem gasto
		if (isExcludedFromTotals(tx.tags)) continue
		const amount = toMoney(tx.amount)
		count++
		if (isPositive(amount)) {
			income = add(income, amount)
			continue
		}

		const spent = absMoney(amount)
		expense = add(expense, spent)
		for (const { tagId } of tx.tags) byTag.set(tagId, add(byTag.get(tagId) ?? zeroMoney(), spent))

		const name = merchantName(tx.description)
		const key = merchantKey(name)
		const merchant = merchants.get(key) ?? {
			name: merchantLabel(name),
			total: zeroMoney(),
			count: 0,
		}
		merchant.total = add(merchant.total, spent)
		merchant.count++
		merchants.set(key, merchant)
	}

	const tagNames = new Map(tags.map((tag) => [tag.id, tag.name]))

	return {
		income: toReais(income),
		expense: toReais(expense),
		count,
		topTags: [...byTag]
			.sort((a, b) => compare(b[1], a[1]))
			.slice(0, 5)
			.map(([tagId, total]) => ({ name: tagNames.get(tagId) ?? 'Tag', total: toReais(total) })),
		topMerchants: [...merchants.values()]
			.sort((a, b) => compare(b.total, a.total))
			.slice(0, 5)
			.map((merchant) => ({ ...merchant, total: toReais(merchant.total) })),
	}
}

/** Gasto do mês em cada tag com orçamento */
export async function budgetUsage(userId: string, monthStart: Date, monthEnd: Date) {
	const tags = await prisma.tag.findMany({
		where: { userId, excludeFromTotals: false, monthlyBudget: { not: null } },
		select: { id: true, name: true, monthlyBudget: true },
	})
	if (tags.length === 0) return []

	const links = await prisma.transactionTag.findMany({
		where: {
			tagId: { in: tags.map((tag) => tag.id) },
			transaction: {
				date: { gte: monthStart, lt: monthEnd },
				amount: { lt: 0 },
				...COUNTS_IN_TOTALS,
			},
		},
		select: { tagId: true, transaction: { select: { amount: true } } },
	})

	return tags.map((tag) => {
		const spent = absMoney(
			sumMoney(
				links
					.filter((link) => link.tagId === tag.id)
					.map((link) => toMoney(link.transaction.amount)),
			),
		)
		const budget = toMoney(tag.monthlyBudget ?? 0)
		return {
			tagId: tag.id,
			name: tag.name,
			budget: toReais(budget),
			spent: toReais(spent),
			// Proporção não é dinheiro: a divisão em float serve
			ratio: toReais(spent) / toReais(budget),
		}
	})
}

/**
 * Até onde TODAS as contas ativas estão importadas: o menor "último dia" entre as contas com
 * transação nos últimos 60 dias (conta parada há mais tempo não segura o resumo)
 */
export async function importedUntil(userId: string) {
	const rows = await prisma.transaction.groupBy({
		by: ['accountId'],
		where: { account: { userId } },
		_max: { date: true },
	})
	const dates = rows.map((row) => row._max.date).filter((date): date is Date => date !== null)
	if (dates.length === 0) return null
	const newest = Math.max(...dates.map((date) => date.getTime()))
	const active = dates.filter((date) => newest - date.getTime() <= 60 * 24 * 60 * 60 * 1000)
	return new Date(Math.min(...active.map((date) => date.getTime())))
}
