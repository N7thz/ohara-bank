import { addMonths, subMonths } from 'date-fns'
import { localToday } from '@/lib/dates'
import {
	add,
	greaterThanOrEqual,
	isPositive,
	isZero,
	type Money,
	multiply,
	sumMoney,
	toMoney,
	toReais,
	zeroMoney,
} from '@/lib/money'
import { prisma } from '@/lib/prisma'
import type { DebtOverrideStatus } from '../../../prisma/generated/client'
import {
	assignPayments,
	day,
	endMonthOf,
	isActiveIn,
	loadExpenses,
	matchPayments,
	monthKey,
	monthStart,
	paidInstallmentsOf,
	splitPattern,
} from './match'
import { suggestRecurring } from './suggestions'

// Usado por GET /api/finance/debts: situação de cada dívida, previsto × pago e sugestões

/** Meses distintos com pagamento, em ordem: cada mês é uma parcela */
const monthsOf = (payments: { date: Date }[]) => [
	...new Set(payments.map((payment) => monthKey(payment.date))),
]

/** Meses passados no gráfico, contando o atual */
const PAST_MONTHS = 6
/** Meses futuros projetados no gráfico */
const FUTURE_MONTHS = 6
/** Janela usada para sugerir gastos que se repetem */
const SUGGESTION_MONTHS = 6

export type DebtMonthStatus =
	| 'paid'
	| 'partial'
	| 'pending'
	| 'late'
	| 'skipped'
	| 'not-started'
	| 'finished'

// Situação marcada à mão → situação mostrada
const OVERRIDE_STATUS = {
	PAID: 'paid',
	PENDING: 'pending',
	SKIPPED: 'skipped',
} as const satisfies Record<DebtOverrideStatus, DebtMonthStatus>

interface Payment {
	date: Date
	amount: number
	description: string
}

export async function getDebtsOverview(userId: string, today: Date = localToday()) {
	const [debts, lastByAccount] = await Promise.all([
		prisma.debt.findMany({
			where: { userId },
			orderBy: [{ kind: 'asc' }, { name: 'asc' }],
			include: { statusOverrides: { select: { month: true, status: true } } },
		}),
		prisma.transaction.groupBy({
			by: ['accountId'],
			where: { account: { userId } },
			_max: { date: true },
		}),
	])

	const current = monthStart(today)
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

	// Uma transação que casa com duas dívidas conta só para a do trecho mais específico
	const owned = assignPayments(debts, normalized)

	const items = debts.map((debt) => {
		const start = monthStart(debt.startMonth)
		const amount = toMoney(debt.amount)
		const mine = matchPayments(debt, normalized).matched.filter((tx) =>
			owned.get(debt.id)?.has(tx.id),
		)
		const end = endMonthOf(debt, monthsOf(mine), current)
		// Depois da última parcela, compra na mesma loja não é pagamento desta dívida
		const matched = end ? mine.filter((tx) => monthStart(tx.date) <= end) : mine
		const paidMonths = monthsOf(matched)
		const payments: Payment[] = matched.map(({ date, amount, description }) => ({
			date,
			amount,
			description,
		}))
		// A dívida é paga pela conta do último pagamento; sem pagamento, vale o extrato mais recente
		const lastAccount = matched.at(-1)?.accountId
		const debtImportedUntil = (lastAccount && importedByAccount.get(lastAccount)) || importedUntil

		const paidByMonth = new Map<string, Money>()
		for (const payment of payments) {
			const key = monthKey(payment.date)
			paidByMonth.set(key, add(paidByMonth.get(key) ?? zeroMoney(), toMoney(payment.amount)))
		}

		const paidTotal = sumMoney(payments.map((payment) => toMoney(payment.amount)))
		const paidInstallments =
			debt.kind === 'INSTALLMENT' && debt.installments ? paidInstallmentsOf(debt, paidMonths) : null
		const remainingAmount =
			debt.kind === 'INSTALLMENT' && debt.installments
				? multiply(amount, debt.installments - (paidInstallments ?? 0))
				: null

		const paidThisMonth = paidByMonth.get(monthKey(current)) ?? zeroMoney()
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

		const overrideByMonth = new Map(
			debt.statusOverrides.map((override) => [monthKey(override.month), override.status]),
		)

		let status: DebtMonthStatus
		if (paidInstallments !== null && debt.installments && paidInstallments >= debt.installments) {
			status = 'finished'
		} else if (!isActiveIn(current, start, end)) {
			status = current < start ? 'not-started' : 'finished'
		} else if (
			isPositive(paidThisMonth) &&
			// 95% da conta já vale como paga
			(debt.kind === 'RECURRING' ||
				greaterThanOrEqual(paidThisMonth, multiply(amount, { amount: 95, scale: 2 })))
		) {
			status = 'paid'
		} else if (isPositive(paidThisMonth)) {
			status = 'partial'
		} else if (dueDate && debtImportedUntil && debtImportedUntil >= dueDate) {
			// Só é atraso se o extrato já cobre o dia do vencimento
			status = 'late'
		} else {
			status = 'pending'
		}

		// Marcada à mão só vale no mês em que foi marcada, e só para fixas e recorrentes:
		// na parcelada, a contagem de parcelas vem das transações
		const autoStatus = status
		const override =
			debt.kind !== 'INSTALLMENT' && isActiveIn(current, start, end)
				? (overrideByMonth.get(monthKey(current)) ?? null)
				: null
		if (override) status = OVERRIDE_STATUS[override]

		return {
			id: debt.id,
			name: debt.name,
			kind: debt.kind,
			amount: toReais(amount),
			dueDay: debt.dueDay,
			installments: debt.installments,
			paidBefore: debt.paidBefore,
			startMonth: day(start),
			endMonth: end ? day(end) : null,
			pattern: debt.pattern,
			paidTotal: toReais(paidTotal),
			paidInstallments,
			remainingAmount: remainingAmount && toReais(remainingAmount),
			paidThisMonth: toReais(paidThisMonth),
			status,
			/** Situação calculada pelas transações, antes da marcada à mão */
			autoStatus,
			statusOverride: override,
			lastPayment: payments.at(-1)
				? { ...payments.at(-1), date: day((payments.at(-1) as Payment).date) }
				: null,
			paymentCount: payments.length,
			/** Meses com pagamento desde o início: viram as parcelas pagas ao parcelar */
			paidMonths: paidMonths.length,
			// Para o gráfico
			_amount: amount,
			_start: start,
			_end: end,
			_paidByMonth: paidByMonth,
			_overrideByMonth: debt.kind === 'INSTALLMENT' ? new Map() : overrideByMonth,
		}
	})

	// Previsto (o que deveria sair) e pago (o que saiu de fato), mês a mês
	const months = []
	for (
		let month = chartStart;
		month <= addMonths(current, FUTURE_MONTHS);
		month = addMonths(month, 1)
	) {
		let expected = zeroMoney()
		let paid = zeroMoney()
		for (const item of items) {
			const key = monthKey(month)
			const override = item._overrideByMonth.get(key)
			// Não cobrada no mês: não entra no previsto
			if (isActiveIn(month, item._start, item._end) && override !== 'SKIPPED') {
				expected = add(expected, item._amount)
			}
			// Fora do período da dívida, pagamento achado não conta no pago do gráfico
			const paidInMonth = isActiveIn(month, item._start, item._end)
				? (item._paidByMonth.get(key) ?? zeroMoney())
				: zeroMoney()
			// Paga por fora do extrato: conta o valor da conta como pago
			paid = add(paid, override === 'PAID' && isZero(paidInMonth) ? item._amount : paidInMonth)
		}
		months.push({
			start: day(month),
			end: day(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0))),
			expected: toReais(expected),
			paid: month > current ? null : toReais(paid),
		})
	}

	const patterns = items.flatMap((item) => splitPattern(item.pattern))
	const suggestions = suggestRecurring(
		normalized.filter(
			(tx) => tx.date >= suggestionStart && !patterns.some((p) => tx.text.includes(p)),
		),
	)

	return {
		debts: items.map(({ _amount, _start, _end, _paidByMonth, _overrideByMonth, ...item }) => item),
		months,
		suggestions,
		importedUntil: importedUntil ? day(importedUntil) : null,
	}
}
