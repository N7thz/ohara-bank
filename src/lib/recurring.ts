import { monthKey } from './dates'
import { merchantKey, merchantLabel, merchantName } from './merchants'
import {
	absMoney,
	divideMoney,
	isPositive,
	type Money,
	maximum,
	minimum,
	sumMoney,
	toMoney,
	toReais,
	zeroMoney,
} from './money'
import { normalizeText } from './text'

// Contatos recorrentes (Pix com pessoas) e contas que voltam todo mês com valor que muda,
// a partir das transações importadas. Usado por /api/finance/recurring

export interface RecurringTransaction {
	date: Date
	/** Com sinal: negativo é saída */
	amount: number
	description: string
	/** Compra no cartão de crédito: só vira conta se cair sempre no mesmo dia (assinatura) */
	isCardPurchase?: boolean
}

interface Counterparty {
	name: string
	isPerson: boolean
	/** O Itaú corta o nome em uns 7 caracteres ("PIX TRANSF MARIA12/03") */
	truncated: boolean
}

const NUBANK_TRANSFER =
	/^transfer[eê]ncia (?:enviada|recebida)(?: pelo pix)?(?: via open banking)? - (.+)$/i
// Contato salvo no Nubank vem sem documento: "Fulano (Transferência enviada)"
const NUBANK_CONTACT = /^(.+?) \(transfer[eê]ncia enviada\)$/i
const ITAU_PERSON = /^pix transf\s+(.+?)\s*\d{2}\/\d{2}\s*$/i
const ITAU_MERCHANT = /^pix (?:qrs|cartao)\s+(.+?)\s*[\d/]*\s*$/i
// CPF mascarado (•••.123.456-••) é pessoa; CNPJ ou nada é empresa
const MASKED_CPF = /•/
// Compra no cartão: só conta como conta se cair sempre no mesmo dia (assinatura)
const CARD_PURCHASE = /^compra no d[eé]bito/i
// Investimento sai todo mês, mas não é conta
const INVESTMENT = /^(?:aplica[cç][aã]o|resgate) rdb/i
// Parcela de compra ("KaBuM 02/03"): tem fim, fica na página de Dívidas
const INSTALLMENT_SUFFIX = /\b\d{2}\/\d{2}$/

/** Quem está do outro lado da transferência; null quando a descrição não é de Pix/transferência */
export function counterpartyOf(description: string): Counterparty | null {
	const text = description.trim()

	const nubank = text.match(NUBANK_TRANSFER)
	if (nubank) {
		const contact = nubank[1].match(NUBANK_CONTACT)
		if (contact) return { name: contact[1].trim(), isPerson: true, truncated: false }
		const [name, document = ''] = nubank[1].split(' - ')
		return { name: name.trim(), isPerson: MASKED_CPF.test(document), truncated: false }
	}

	const itauPerson = text.match(ITAU_PERSON)
	if (itauPerson) return { name: itauPerson[1].trim(), isPerson: true, truncated: true }

	const itauMerchant = text.match(ITAU_MERCHANT)
	if (itauMerchant) return { name: itauMerchant[1].trim(), isPerson: false, truncated: true }

	return null
}

const PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

function nameTokens(name: string) {
	return normalizeText(name)
		.split(/\s+/)
		.filter((token) => token && !PARTICLES.has(token))
}

/** "MARIA S F C SOUZA" e "Maria da Silva ... Souza" viram "maria souza" */
function personKey(name: string) {
	const tokens = nameTokens(name)
	return tokens.length > 1 ? `${tokens[0]} ${tokens.at(-1)}` : (tokens[0] ?? '')
}

export { monthKey }

const day = (date: Date) => date.toISOString().slice(0, 10)
// Soma em float acumula erro de centavos
// Proporções (variação, tendência) não são dinheiro: arredondam em duas casas
const round = (value: number) => Math.round(value * 100) / 100
const meanMoney = (values: Money[]) => divideMoney(sumMoney(values), values.length)
/** Soma dos valores absolutos, em Money */
const sumAbs = (list: { amount: number }[]) =>
	sumMoney(list.map((tx) => absMoney(toMoney(tx.amount))))

/** Meses AAAA-MM de from até to, inclusive */
function monthRange(from: string, to: string) {
	const months: string[] = []
	let [year, month] = from.split('-').map(Number)
	while (true) {
		const key = `${year}-${String(month).padStart(2, '0')}`
		if (key > to) break
		months.push(key)
		month++
		if (month > 12) {
			month = 1
			year++
		}
	}
	return months
}

function lastDayOf(month: string) {
	const [year, m] = month.split('-').map(Number)
	return new Date(Date.UTC(year, m, 0)).getUTCDate()
}

/** O dia do mês que mais concentra pagamentos (janela de ±window dias) e a fração que cai nela */
function typicalDay(days: number[], window: number) {
	let best = { day: days[0], share: 0 }
	for (let candidate = 1; candidate <= 31; candidate++) {
		const inside = days.filter((d) => {
			const distance = Math.abs(d - candidate)
			return Math.min(distance, 31 - distance) <= window
		})
		const share = inside.length / days.length
		if (share > best.share) {
			const sorted = inside.slice().sort((a, b) => a - b)
			best = { day: sorted[Math.floor(sorted.length / 2)], share }
		}
	}
	return best
}

interface Group {
	key: string
	/** Nomes vistos no extrato */
	names: string[]
	isPerson: boolean
	transactions: RecurringTransaction[]
}

function addTo(
	map: Map<string, Group>,
	key: string,
	name: string,
	isPerson: boolean,
	tx: RecurringTransaction,
) {
	const group = map.get(key) ?? { key, names: [], isPerson, transactions: [] }
	group.names.push(name)
	group.transactions.push(tx)
	map.set(key, group)
}

/**
 * Junta os nomes cortados do Itaú no grupo cujo nome completo começa igual, quando só
 * um grupo bate. Com dois candidatos ("Luiz Cláudio" e "Luiz Gustavo"), fica separado
 */
function mergeTruncated(groups: Map<string, Group>, truncated: Map<string, Group>) {
	for (const [prefix, group] of truncated) {
		const matches = [...groups.values()].filter((candidate) =>
			candidate.names.some(
				(name) =>
					normalizeText(name).startsWith(prefix) || nameTokens(name).join(' ').startsWith(prefix),
			),
		)
		if (prefix.length >= 4 && matches.length === 1) {
			matches[0].transactions.push(...group.transactions)
			matches[0].names.push(...group.names)
		} else {
			const existing = groups.get(prefix)
			if (existing) {
				existing.transactions.push(...group.transactions)
				existing.names.push(...group.names)
			} else groups.set(prefix, group)
		}
	}
	for (const group of groups.values()) {
		group.transactions.sort((a, b) => b.date.getTime() - a.date.getTime())
	}
	return [...groups.values()]
}

/** Nome para mostrar: o mais completo visto no extrato */
function displayName(names: string[]) {
	return merchantLabel(names.reduce((best, name) => (name.length > best.length ? name : best), ''))
}

/**
 * Trecho para a busca da lista de transações: o nome inteiro quando é sempre o mesmo; com
 * variações ("MARIA S F C SOUZA", "Maria da Silva..."), só a primeira palavra
 */
function searchQuery(names: string[]) {
	const distinct = new Set(names.map(normalizeText))
	if (distinct.size === 1) return names[0].trim()
	return names[0].trim().split(/\s+/)[0]
}

// ---------------------------------------------------------------- contatos

export interface RecurringContact {
	key: string
	name: string
	/** Trecho para buscar na lista de transações */
	query: string
	sent: number
	received: number
	sentCount: number
	receivedCount: number
	/** Meses diferentes com transferência */
	months: number
	firstDate: string
	lastDate: string
	/** Últimos 12 meses, do mais antigo para o atual */
	monthly: { month: string; sent: number; received: number }[]
}

/** Contatos: Pix com pessoas (CPF), nos dois sentidos, com 2 transferências ou mais */
export function findContacts(transactions: RecurringTransaction[], today: Date) {
	const groups = new Map<string, Group>()
	const truncated = new Map<string, Group>()

	for (const tx of transactions) {
		const party = counterpartyOf(tx.description)
		if (!party?.isPerson) continue
		if (party.truncated) addTo(truncated, normalizeText(party.name), party.name, true, tx)
		else addTo(groups, personKey(party.name), party.name, true, tx)
	}

	const yearAgo = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth() + 1, 1))
	const window = monthRange(monthKey(yearAgo), monthKey(today))

	return mergeTruncated(groups, truncated)
		.filter((group) => group.transactions.length >= 2)
		.map((group): RecurringContact => {
			const txs = group.transactions
			const sent = txs.filter((tx) => tx.amount < 0)
			const received = txs.filter((tx) => tx.amount > 0)
			const sum = (list: RecurringTransaction[]) => toReais(sumAbs(list))
			const inMonth = (list: RecurringTransaction[], month: string) =>
				sum(list.filter((tx) => monthKey(tx.date) === month))
			// Os nomes cortados do Itaú não entram na busca: o Nubank traz o nome inteiro
			const fullNames = group.names.filter((name) => name.length > 7)
			return {
				key: group.key,
				name: displayName(group.names),
				query: searchQuery(fullNames.length > 0 ? fullNames : group.names),
				sent: sum(sent),
				received: sum(received),
				sentCount: sent.length,
				receivedCount: received.length,
				months: new Set(txs.map((tx) => monthKey(tx.date))).size,
				firstDate: day(txs[txs.length - 1].date),
				lastDate: day(txs[0].date),
				monthly: window.map((month) => ({
					month,
					sent: inMonth(sent, month),
					received: inMonth(received, month),
				})),
			}
		})
		.sort((a, b) => b.months - a.months || b.lastDate.localeCompare(a.lastDate))
}

// ---------------------------------------------------------------- contas

export interface BillHistory {
	/** FIXED: mesmo valor todo mês; RECURRING: o valor muda (luz, fatura) */
	kind: 'FIXED' | 'RECURRING'
	count: number
	/** Meses com pagamento */
	months: number
	/** Média, mínimo e máximo do total de cada mês com pagamento */
	average: number
	min: number
	max: number
	/** (máximo − mínimo) ÷ média */
	variation: number
	/** Média dos últimos 3 meses com pagamento: o palpite para o próximo */
	estimate: number
	/** Último mês pago comparado à média dos anteriores; null com só um mês */
	trend: number | null
	typicalDay: number
	lastPayment: { date: string; amount: number } | null
	/** Total pago no mês atual; 0 se ainda não pagou */
	paidThisMonth: number
	/** AAAA-MM-DD do próximo pagamento esperado */
	nextDue: string
	/** Sem pagamento há mais de 2 meses: provavelmente cancelada ou atrasada */
	active: boolean
	/** Do primeiro mês até o atual; null nos meses sem pagamento */
	monthly: { month: string; amount: number | null }[]
}

/**
 * Histórico mês a mês de uma conta a partir dos pagamentos (valores positivos). Pagamentos
 * de dois meses juntos (luz atrasada) somam no mês em que saíram
 */
export function billHistory(
	payments: { date: Date; amount: number }[],
	today: Date,
	options: { from?: string; dueDay?: number | null } = {},
): BillHistory {
	const currentMonth = monthKey(today)
	const totals = new Map<string, Money[]>()
	for (const payment of payments) {
		const month = monthKey(payment.date)
		totals.set(month, [...(totals.get(month) ?? []), toMoney(payment.amount)])
	}
	const monthTotal = (month: string) => sumMoney(totals.get(month) ?? [])
	const paidMonths = [...totals.keys()].sort()
	const amounts = paidMonths.map(monthTotal)
	const sorted = payments.slice().sort((a, b) => b.date.getTime() - a.date.getTime())
	const last = sorted[0]

	const average = toReais(amounts.length > 0 ? meanMoney(amounts) : zeroMoney())
	const min = toReais(amounts.length > 0 ? minimum(amounts as [Money, ...Money[]]) : zeroMoney())
	const max = toReais(amounts.length > 0 ? maximum(amounts as [Money, ...Money[]]) : zeroMoney())
	const previous = amounts.slice(0, -1)
	const paidThisMonth = monthTotal(currentMonth)
	const typical =
		options.dueDay ??
		(payments.length > 0
			? typicalDay(
					payments.map((p) => p.date.getUTCDate()),
					7,
				).day
			: 1)
	const dueMonth = isPositive(paidThisMonth) ? monthRange(currentMonth, '9999-12')[1] : currentMonth
	const firstMonth = [options.from, paidMonths[0]].filter(Boolean).sort()[0] ?? currentMonth

	return {
		kind: max - min <= max * 0.01 ? 'FIXED' : 'RECURRING',
		count: payments.length,
		months: paidMonths.length,
		average,
		min,
		max,
		variation: average > 0 ? round((max - min) / average) : 0,
		estimate: amounts.length > 0 ? toReais(meanMoney(amounts.slice(-3))) : 0,
		trend:
			previous.length > 0
				? round(toReais(amounts[amounts.length - 1]) / toReais(meanMoney(previous)) - 1)
				: null,
		typicalDay: typical,
		lastPayment: last ? { date: day(last.date), amount: toReais(toMoney(last.amount)) } : null,
		paidThisMonth: toReais(paidThisMonth),
		nextDue: `${dueMonth}-${String(Math.min(typical, lastDayOf(dueMonth))).padStart(2, '0')}`,
		active:
			paidMonths.length > 0 &&
			monthRange(paidMonths[paidMonths.length - 1], currentMonth).length <= 3,
		monthly: monthRange(firstMonth, currentMonth).map((month) => {
			return { month, amount: totals.has(month) ? toReais(monthTotal(month)) : null }
		}),
	}
}

export interface BillSuggestion extends BillHistory {
	key: string
	name: string
	isPerson: boolean
	query: string
	/** Trecho(s) da descrição, no formato do padrão de dívida ("a|b") */
	pattern: string
}

/**
 * Contas ainda não cadastradas em Dívidas: saídas que voltam em 3 meses ou mais.
 * - Pix, boleto e débito automático: luz e afins são pagos quando dá, às vezes dois meses
 *   juntos, então basta aparecer em 3 meses com no máximo 2 pagamentos por mês
 * - Compra no cartão: só em 4 meses ou mais, 1 por mês e quase sempre no mesmo dia (±3),
 *   que é o jeito de uma assinatura; mercado e padaria ficam de fora
 */
export function suggestBills(
	expenses: RecurringTransaction[],
	today: Date,
	/** Padrões das dívidas já cadastradas ("a|b"): o que eles acham não vira sugestão */
	debtPatterns: string[],
) {
	const debtParts = debtPatterns.flatMap((pattern) =>
		pattern.split('|').map(normalizeText).filter(Boolean),
	)
	const groups = new Map<string, Group>()
	const truncated = new Map<string, Group>()

	for (const tx of expenses) {
		if (tx.amount >= 0 || INVESTMENT.test(tx.description)) continue
		if (INSTALLMENT_SUFFIX.test(tx.description.trim())) continue
		const text = normalizeText(tx.description)
		if (debtParts.some((part) => text.includes(part))) continue
		const party = counterpartyOf(tx.description)
		if (party?.truncated) {
			addTo(truncated, normalizeText(party.name), party.name, party.isPerson, tx)
		} else if (party?.isPerson) {
			addTo(groups, personKey(party.name), party.name, true, tx)
		} else {
			const name = party?.name ?? merchantName(tx.description)
			addTo(groups, merchantKey(name), name, false, tx)
		}
	}

	return mergeTruncated(groups, truncated)
		.filter((group) => {
			const txs = group.transactions
			const months = new Set(txs.map((tx) => monthKey(tx.date))).size
			if (toReais(divideMoney(sumAbs(txs), months)) < 10) return false
			const purchases = txs.filter(
				(tx) => tx.isCardPurchase || CARD_PURCHASE.test(tx.description),
			).length
			if (purchases > txs.length / 2) {
				const { share } = typicalDay(
					txs.map((tx) => tx.date.getUTCDate()),
					3,
				)
				return months >= 4 && txs.length / months <= 1.25 && share >= 0.75
			}
			return months >= 3 && txs.length / months <= 2
		})
		.map((group): BillSuggestion => {
			// Nome contido em outro sai: "enel distri" (Itaú, cortado) já acha "enel distribuicao rio"
			const names = [...new Set(group.names.map(normalizeText).filter((name) => name.length >= 3))]
			const pattern = names
				.filter((name) => !names.some((other) => other !== name && name.includes(other)))
				.join('|')
				.slice(0, 120)
			return {
				key: group.key,
				name: displayName(group.names),
				isPerson: group.isPerson,
				query: searchQuery(group.names),
				pattern,
				...billHistory(
					group.transactions.map((tx) => ({ date: tx.date, amount: Math.abs(tx.amount) })),
					today,
				),
			}
		})
		.filter((bill) => bill.active && bill.pattern.length >= 3)
		.sort((a, b) => b.average - a.average)
}
