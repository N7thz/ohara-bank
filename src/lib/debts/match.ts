import { UTCDate } from '@date-fns/utc'
import { addMonths, startOfMonth } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { COUNTS_IN_TOTALS, normalizeText } from '@/lib/tags'
import type { DebtKind } from '../../../prisma/generated/client'

// Como uma dívida acha seus pagamentos nas transações; usado pelo resumo de dívidas
// (/api/finance/debts) e pelas parcelas da lista de transações (/api/finance/transactions)

export const day = (date: Date) => date.toISOString().slice(0, 10)
export const monthKey = (date: Date) => date.toISOString().slice(0, 7)
export const monthStart = (date: Date) => startOfMonth(new UTCDate(date))
// Soma em float acumula erro de centavos
export const round = (value: number) => Math.round(value * 100) / 100

/** "telefonica|vivo-rj" → ["telefonica", "vivo-rj"]: a mesma conta com descrições diferentes */
export function splitPattern(pattern: string) {
	return pattern.split('|').map(normalizeText).filter(Boolean)
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
 * Último mês da parcelada: depois do último mês pago vêm as parcelas que faltam, uma por
 * mês a partir do mês atual (ou do próximo, se o atual já foi pago). Fixas e recorrentes
 * não terminam
 */
export function endMonthOf(
	debt: { kind: DebtKind; startMonth: Date; installments: number | null },
	paidMonths: string[],
	current: Date,
) {
	if (debt.kind !== 'INSTALLMENT' || !debt.installments) return null
	const start = monthStart(debt.startMonth)
	const paid = Math.min(debt.installments, paidMonths.length)
	const pending = debt.installments - paid
	if (pending === 0) {
		const last = paidMonths[debt.installments - 1]
		return last ? new UTCDate(`${last}-01T00:00:00Z`) : start
	}
	const paidCurrent = paidMonths.includes(monthKey(current))
	const next = paidCurrent ? addMonths(current, 1) : current
	return addMonths(next < start ? start : next, pending - 1)
}
