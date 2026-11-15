import { UTCDate } from '@date-fns/utc'
import { addMonths } from 'date-fns'
import { monthKey, monthStart } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { COUNTS_IN_TOTALS, normalizeText } from '@/lib/tags'
import type { DebtKind } from '../../../prisma/generated/client'

// Como uma dívida acha seus pagamentos nas transações; usado pelo resumo de dívidas
// (/api/finance/debts) e pelas parcelas da lista de transações (/api/finance/transactions)

export { day, monthKey, monthStart } from '@/lib/dates'

/** "telefonica|vivo-rj" → ["telefonica", "vivo-rj"]: a mesma conta com descrições diferentes */
export function splitPattern(pattern: string) {
	// Trecho com menos de 3 letras ("a") casaria com quase tudo
	return pattern
		.split('|')
		.map(normalizeText)
		.filter((part) => part.length >= 3)
}

export function isActiveIn(month: Date, start: Date, end: Date | null) {
	return month >= start && (!end || month <= end)
}

// Só saídas que contam nos totais: transferência entre contas próprias não é pagamento
export async function loadExpenses(userId: string, since: Date) {
	const expenses = await prisma.transaction.findMany({
		where: {
			AND: [{ account: { userId } }, COUNTS_IN_TOTALS, { amount: { lt: 0 }, date: { gte: since } }],
		},
		select: { id: true, date: true, amount: true, description: true, accountId: true },
		orderBy: { date: 'asc' },
	})
	return expenses.map((tx) => ({
		id: tx.id,
		date: tx.date,
		accountId: tx.accountId,
		amount: Math.abs(Number(tx.amount)),
		description: tx.description,
		text: normalizeText(tx.description),
	}))
}

export type Expense = Awaited<ReturnType<typeof loadExpenses>>[number]

export function matchPayments(debt: { startMonth: Date; pattern: string }, expenses: Expense[]) {
	const start = monthStart(debt.startMonth)
	const patterns = splitPattern(debt.pattern)
	const matched = expenses.filter(
		(tx) => tx.date >= start && patterns.some((pattern) => tx.text.includes(pattern)),
	)
	// Cada mês com pagamento é uma parcela, mesmo pago em várias transferências
	const paidMonths = [...new Set(matched.map((tx) => monthKey(tx.date)))]
	return { matched, paidMonths }
}

/**
 * Cada transação conta para uma dívida só: a do trecho mais longo (mais específico) que casa
 * com a descrição; empate fica com a primeira da lista. Devolve os ids de transação de cada dívida
 */
export function assignPayments(
	debts: { id: string; startMonth: Date; pattern: string }[],
	expenses: Expense[],
) {
	const candidates = debts.map((debt) => ({
		id: debt.id,
		start: monthStart(debt.startMonth),
		patterns: splitPattern(debt.pattern),
	}))
	const owned = new Map<string, Set<string>>(debts.map((debt) => [debt.id, new Set<string>()]))

	for (const tx of expenses) {
		let best: { id: string; length: number } | null = null
		for (const debt of candidates) {
			if (tx.date < debt.start) continue
			const length = Math.max(
				0,
				...debt.patterns.filter((pattern) => tx.text.includes(pattern)).map((p) => p.length),
			)
			if (length > 0 && (!best || length > best.length)) best = { id: debt.id, length }
		}
		if (best) owned.get(best.id)?.add(tx.id)
	}
	return owned
}

/** Parcelas pagas: as informadas à mão mais os meses com pagamento nas transações */
export function paidInstallmentsOf(
	debt: { installments: number | null; paidBefore: number },
	paidMonths: string[],
) {
	return Math.min(debt.installments ?? 0, debt.paidBefore + paidMonths.length)
}

/**
 * Último mês da parcelada: depois do último mês pago vêm as parcelas que faltam, uma por
 * mês a partir do mês atual (ou do próximo, se o atual já foi pago). Fixas e recorrentes
 * não terminam
 */
export function endMonthOf(
	debt: { kind: DebtKind; startMonth: Date; installments: number | null; paidBefore: number },
	paidMonths: string[],
	current: Date,
) {
	if (debt.kind !== 'INSTALLMENT' || !debt.installments) return null
	const start = monthStart(debt.startMonth)
	const paid = paidInstallmentsOf(debt, paidMonths)
	const pending = debt.installments - paid
	if (pending === 0) {
		// As pagas à mão vêm antes das achadas nas transações
		const last = paidMonths[debt.installments - debt.paidBefore - 1]
		return last
			? new UTCDate(`${last}-01T00:00:00Z`)
			: addMonths(start, Math.max(0, debt.installments - 1))
	}
	const paidCurrent = paidMonths.includes(monthKey(current))
	const next = paidCurrent ? addMonths(current, 1) : current
	return addMonths(next < start ? start : next, pending - 1)
}
