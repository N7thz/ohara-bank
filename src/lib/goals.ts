import { monthStart } from './dates'
import { divideMoney, isNegative, isZero, subtract, toMoney, toReais, zeroMoney } from './money'

// Contas das metas de economia. Valores em reais (number) na entrada e na saída; por dentro
// tudo passa por centavos inteiros

/** Quanto da meta já foi juntado (ratio de 0 a 1) e quanto falta (nunca negativo) */
export function goalProgress({ target, saved }: { target: number; saved: number }) {
	const missing = subtract(toMoney(target), toMoney(saved))
	const remaining = isNegative(missing) ? zeroMoney() : missing
	const ratio = target > 0 ? Math.min(1, Math.max(0, saved / target)) : 0
	return { ratio, remaining: toReais(remaining) }
}

/** Meses do mês de `today` até o mês-alvo, contando os dois; 0 ou menos = prazo vencido */
export function monthsUntil(targetMonth: Date, today: Date) {
	const target = monthStart(targetMonth)
	const current = monthStart(today)
	return (
		(target.getUTCFullYear() - current.getUTCFullYear()) * 12 +
		(target.getUTCMonth() - current.getUTCMonth()) +
		1
	)
}

/**
 * Valor por mês para chegar no mês-alvo (inclusive, contando o mês atual). Prazo vencido:
 * todo o restante. Sem prazo: null
 */
export function monthlyNeeded({
	remaining,
	targetMonth,
	today,
}: {
	remaining: number
	targetMonth: Date | null
	today: Date
}) {
	if (!targetMonth) return null
	const left = toMoney(remaining)
	if (isZero(left) || isNegative(left)) return 0
	const months = monthsUntil(targetMonth, today)
	if (months <= 1) return toReais(left)
	return toReais(divideMoney(left, months))
}

/** Meses até completar com a economia média; null se a média não for positiva */
export function monthsToReach({
	remaining,
	averageSavings,
}: {
	remaining: number
	averageSavings: number
}) {
	if (averageSavings <= 0) return null
	if (remaining <= 0) return 0
	return Math.ceil(remaining / averageSavings)
}

/** Últimos `count` meses completos com transações (exclui o mês atual), do mais antigo ao mais novo */
export function completeMonths<T extends { start: string; count: number }>(
	periods: T[],
	currentMonthKey: string,
	count = 3,
) {
	return periods
		.filter((period) => period.count > 0 && period.start.slice(0, 7) < currentMonthKey)
		.slice(-count)
}

/** Economia média dos últimos 3 meses completos com transações; null sem nenhum */
export function averageSavings(
	periods: { start: string; income: number; expense: number; count: number }[],
	currentMonthKey: string,
	count = 3,
) {
	const complete = completeMonths(periods, currentMonthKey, count)
	if (complete.length === 0) return null
	const total = complete.reduce((sum, period) => sum + period.income + period.expense, 0)
	return Math.round((total / complete.length) * 100) / 100
}

/** Taxa de poupança (economia ÷ entradas) dos mesmos meses; null sem entradas */
export function savingsRate(
	periods: { start: string; income: number; expense: number; count: number }[],
	currentMonthKey: string,
	count = 3,
) {
	const complete = completeMonths(periods, currentMonthKey, count)
	const income = complete.reduce((sum, period) => sum + period.income, 0)
	if (income <= 0) return null
	const saved = complete.reduce((sum, period) => sum + period.income + period.expense, 0)
	return saved / income
}
