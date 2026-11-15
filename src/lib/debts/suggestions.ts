import { divideMoney, sumMoney, toMoney, toReais } from '@/lib/money'
import type { DebtKind } from '../../../prisma/generated/client'
import { monthKey } from './match'

// Gastos que se repetem e ainda não são dívida: sugestões da página de Dívidas

// Prefixos de extrato que não ajudam a reconhecer o credor
const NOISE_PREFIXES = [
	'compra no debito via nupay - ',
	'compra no debito - ',
	'transferencia enviada pelo pix - ',
	'pix transf ',
	'pagamento de ',
]

function nameFromPattern(pattern: string) {
	let name = pattern
	for (const prefix of NOISE_PREFIXES) {
		if (name.startsWith(prefix)) name = name.slice(prefix.length)
	}
	name = name
		.split(' - ')[0]
		.replace(/\(.*\)/g, '')
		.trim()
	return name.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) || pattern
}

function commonPrefix(texts: string[]) {
	let prefix = texts[0]
	for (const text of texts.slice(1)) {
		while (!text.startsWith(prefix)) prefix = prefix.slice(0, -1)
	}
	return prefix
}

/**
 * Saídas que aparecem em 3 ou mais meses, no máximo umas 1,5 vez por mês: candidatas a
 * conta fixa ou recorrente. Compras do dia a dia (Uber, mercado) repetem mais vezes
 * por mês e ficam de fora
 */
export function suggestRecurring(transactions: { date: Date; amount: number; text: string }[]) {
	const groups = new Map<string, typeof transactions>()
	for (const tx of transactions) {
		// Números mudam a cada mês (datas, ids): agrupa sem eles
		const key = tx.text.replace(/\d+/g, '#')
		groups.set(key, [...(groups.get(key) ?? []), tx])
	}

	return [...groups.values()]
		.map((group) => {
			const months = new Set(group.map((tx) => monthKey(tx.date))).size
			const total = sumMoney(group.map((tx) => toMoney(tx.amount)))
			const amounts = group.map((tx) => tx.amount)
			const min = Math.min(...amounts)
			const max = Math.max(...amounts)
			// O trecho comum vai até o primeiro número, que muda de um mês para o outro
			const pattern = commonPrefix(group.map((tx) => tx.text))
				.split(/\d/)[0]
				.replace(/[\s\-–:•.*/]+$/, '')
			const days = group.map((tx) => tx.date.getUTCDate())
			const dueDay = days
				.slice()
				.sort((a, b) => days.filter((d) => d === b).length - days.filter((d) => d === a).length)[0]

			return {
				name: nameFromPattern(pattern),
				pattern,
				kind: (max - min <= max * 0.01 ? 'FIXED' : 'RECURRING') as DebtKind,
				amount: toReais(divideMoney(total, months)),
				dueDay,
				months,
				count: group.length,
				/** AAAA-MM do primeiro pagamento na janela */
				firstMonth: monthKey(group[0].date),
			}
		})
		.filter(
			(group) =>
				group.months >= 3 &&
				group.count / group.months <= 1.5 &&
				group.amount >= 10 &&
				group.pattern.length >= 5,
		)
		.sort((a, b) => b.amount - a.amount)
		.slice(0, 10)
}
