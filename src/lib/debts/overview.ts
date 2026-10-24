import { addMonths, subMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import {
	day,
	endMonthOf,
	isActiveIn,
	loadExpenses,
	matchPayments,
	monthKey,
	monthStart,
	round,
	splitPattern,
} from './match'
import { suggestRecurring } from './suggestions'

// Usado por GET /api/finance/debts: situação de cada dívida, previsto × pago e sugestões

/** Meses passados no gráfico, contando o atual */
const PAST_MONTHS = 6
/** Meses futuros projetados no gráfico */
const FUTURE_MONTHS = 6
/** Janela usada para sugerir gastos que se repetem */
const SUGGESTION_MONTHS = 6

export type DebtMonthStatus = 'paid' | 'partial' | 'pending' | 'late' | 'not-started' | 'finished'

interface Payment {
	date: Date
	amount: number
	description: string
}

export async function getDebtsOverview(userId: string) {
	const [debts, lastByAccount] = await Promise.all([
		prisma.debt.findMany({ where: { userId }, orderBy: [{ kind: 'asc' }, { name: 'asc' }] }),
		prisma.transaction.groupBy({
			by: ['accountId'],
			where: { account: { userId } },
			_max: { date: true },
		}),
	])

	const current = monthStart(new Date())
	const chartStart = subMonths(current, PAST_MONTHS - 1)
	const suggestionStart = subMonths(current, SUGGESTION_MONTHS - 1)
	const earliestDebt = debts.reduce<Date | null>(
		(min, debt) => (!min || debt.startMonth < min ? monthStart(debt.startMonth) : min),
		null,
	)
	const since = earliestDebt && earliestDebt < suggestionStart ? earliestDebt : suggestionStart

	const normalized = await loadExpenses(userId, since)

	// Até onde os extratos de cada conta vão: depois disso, "não pago" pode ser só
	// extrato não importado
	const importedByAccount = new Map(
		lastByAccount.map((row) => [row.accountId, row._max.date as Date]),
	)
	const importedUntil = [...importedByAccount.values()].sort((a, b) => +b - +a)[0] ?? null

	const items = debts.map((debt) => {
		const start = monthStart(debt.startMonth)
		const amount = Number(debt.amount)
		const { matched, paidMonths } = matchPayments(debt, normalized)
		const end = endMonthOf(debt, paidMonths, current)
		const payments: Payment[] = matched.map(({ date, amount, description }) => ({
			date,
			amount,
			description,
		}))
		// A dívida é paga pela conta do último pagamento; sem pagamento, vale o extrato mais recente
		const lastAccount = matched.at(-1)?.accountId
		const debtImportedUntil = (lastAccount && importedByAccount.get(lastAccount)) || importedUntil

		const paidByMonth = new Map<string, number>()
		for (const payment of payments) {
			const key = monthKey(payment.date)
			paidByMonth.set(key, (paidByMonth.get(key) ?? 0) + payment.amount)
		}

		const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0)
		const paidInstallments =
			debt.kind === 'INSTALLMENT' && debt.installments
				? Math.min(debt.installments, paidMonths.length)
				: null
		const remainingAmount =
			debt.kind === 'INSTALLMENT' && debt.installments
				? round((debt.installments - (paidInstallments ?? 0)) * amount)
				: null

		const paidThisMonth = paidByMonth.get(monthKey(current)) ?? 0
		const dueDate = debt.dueDay
			? new Date(
					Date.UTC(
						current.getUTCFullYear(),
						current.getUTCMonth(),
						// Dia 31 em mês de 30 dias vence no último dia
						Math.min(
							debt.dueDay,
							new Date(
								Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0),
							).getUTCDate(),
						),
					),
				)
			: null

		let status: DebtMonthStatus
		if (paidInstallments !== null && debt.installments && paidInstallments >= debt.installments) {
			status = 'finished'
		} else if (!isActiveIn(current, start, end)) {
			status = current < start ? 'not-started' : 'finished'
		} else if (paidThisMonth > 0 && (debt.kind === 'RECURRING' || paidThisMonth >= amount * 0.95)) {
			status = 'paid'
		} else if (paidThisMonth > 0) {
			status = 'partial'
		} else if (dueDate && debtImportedUntil && debtImportedUntil >= dueDate) {
			// Só é atraso se o extrato já cobre o dia do vencimento
			status = 'late'
		} else {
			status = 'pending'
		}

		return {
			id: debt.id,
			name: debt.name,
			kind: debt.kind,
			amount,
			dueDay: debt.dueDay,
			installments: debt.installments,
			startMonth: day(start),
			endMonth: end ? day(end) : null,
			pattern: debt.pattern,
			paidTotal: round(paidTotal),
			paidInstallments,
			remainingAmount,
			paidThisMonth: round(paidThisMonth),
			status,
			lastPayment: payments.at(-1)
				? { ...payments.at(-1), date: day((payments.at(-1) as Payment).date) }
				: null,
			paymentCount: payments.length,
			/** Meses com pagamento desde o início: viram as parcelas pagas ao parcelar */
			paidMonths: paidMonths.length,
			// Para o gráfico
			_start: start,
			_end: end,
			_paidByMonth: paidByMonth,
		}
	})

	// Previsto (o que deveria sair) e pago (o que saiu de fato), mês a mês
	const months = []
	for (
		let month = chartStart;
		month <= addMonths(current, FUTURE_MONTHS);
		month = addMonths(month, 1)
	) {
		let expected = 0
		let paid = 0
		for (const item of items) {
			if (isActiveIn(month, item._start, item._end)) expected += item.amount
			paid += item._paidByMonth.get(monthKey(month)) ?? 0
		}
		months.push({
			start: day(month),
			end: day(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0))),
			expected: round(expected),
			paid: month > current ? null : round(paid),
		})
	}

	const patterns = items.flatMap((item) => splitPattern(item.pattern))
	const suggestions = suggestRecurring(
		normalized.filter(
			(tx) => tx.date >= suggestionStart && !patterns.some((p) => tx.text.includes(p)),
		),
	)

	return {
		debts: items.map(({ _start, _end, _paidByMonth, ...item }) => item),
		months,
		suggestions,
		importedUntil: importedUntil ? day(importedUntil) : null,
	}
}
