import { groupRows, type PdfItem, type PdfRow } from '@/lib/pdf'
import { hashIds } from './csv'
import type { ParsedStatement, ParsedTransaction } from './types'

// Fatura do cartão de crédito Itaú em PDF (a que chega por e-mail, com senha). A página de
// lançamentos tem duas colunas lado a lado; cada uma é lida de cima para baixo, a da
// esquerda antes da da direita

const DAY_MONTH = /^(\d{2})\/(\d{2})$/
const LEADING_DAY_MONTH = /^(\d{2})\/(\d{2})(?:\s+(.+))?$/
const FULL_DATE = /(\d{2})\/(\d{2})\/(\d{4})/
const MONEY = /^-?\d{1,3}(\.\d{3})*,\d{2}$/
// "Eventim *E 03/05": parcela 3 de 5
const INSTALLMENT = /\b(\d{2})\/(\d{2})$/

type Section = 'payments' | 'purchases' | 'international' | 'future' | null

function rowText(row: PdfRow): string {
	return row.map((item) => item.text).join(' ')
}

// -1.335,16 → -1335.16
function parseAmount(text: string): number {
	return Number(text.replace(/\./g, '').replace(',', '.'))
}

function parseFullDate(text: string): Date | null {
	const match = text.match(FULL_DATE)
	if (!match) return null
	return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])))
}

/** Primeira página em linhas: "Cartão" e o número podem vir como itens separados */
function firstPageText(pages: PdfItem[][]): string {
	return groupRows(pages[0] ?? [])
		.map(rowText)
		.join('\n')
}

/** Fatura do cartão Itaú: resumo da fatura e cartão mascarado na primeira página */
export function isItauCardStatement(pages: PdfItem[][]): boolean {
	const text = firstPageText(pages)
	return /resumo da fatura/i.test(text) && /cart[aã]o\s+\d{4}\.X{4}\.X{4}\.\d{4}/i.test(text)
}

/** O lançamento só traz dia e mês: o ano vem do fechamento (compra de dezembro numa fatura de janeiro) */
function withYear(day: number, month: number, closing: Date): Date {
	const year =
		month > closing.getUTCMonth() + 1 ? closing.getUTCFullYear() - 1 : closing.getUTCFullYear()
	return new Date(Date.UTC(year, month - 1, day))
}

export function parseItauCardStatement(pages: PdfItem[][]): ParsedStatement {
	const firstPage = firstPageText(pages)
	const card = firstPage.match(/cart[aã]o\s+\d{4}\.X{4}\.X{4}\.(\d{4})/i)?.[1]
	const closing = parseFullDate(firstPage.match(/emiss[aã]o:\s*([\d/]+)/i)?.[1] ?? '')
	// Só os lançamentos do mês: o total da fatura ainda soma saldo anterior e créditos
	const total = firstPage.match(/lan[cç]amentos atuais\s+(-?[\d.]+,\d{2})/i)?.[1]
	if (!card || !closing) throw new Error('Fatura do Itaú sem número do cartão ou data de emissão')

	const parsed: Omit<ParsedTransaction, 'externalId'>[] = []
	let section: Section = null
	let listedTotal: number | null = null

	for (const page of pages.slice(1)) {
		// Duas colunas: a segunda começa onde estão as datas mais à direita (os valores da
		// primeira coluna ficam antes delas)
		const dateXs = page.filter((item) => DAY_MONTH.test(item.text)).map((item) => item.x)
		const firstColumn = Math.min(...dateXs)
		const secondColumn = Math.min(...dateXs.filter((x) => x > firstColumn + 100))
		// Sem datas na segunda coluna (ela traz limites e encargos), a divisão fica na mesma
		// distância de sempre: a segunda coluna começa uns 218pt depois da primeira
		const split = Number.isFinite(secondColumn) ? secondColumn - 4 : firstColumn + 205
		const columns = [page.filter((item) => item.x < split), page.filter((item) => item.x >= split)]

		for (const row of columns.flatMap(groupRows)) {
			const text = rowText(row)

			if (/^pagamentos efetuados/i.test(text)) section = 'payments'
			else if (/^lan[cç]amentos: compras e saques/i.test(text)) section = 'purchases'
			else if (/^lan[cç]amentos internacionais/i.test(text)) section = 'international'
			else if (/^compras parceladas/i.test(text)) section = 'future'

			const totalMatch = text.match(/total dos lan[cç]amentos atuais\s+(-?[\d.]+,\d{2})$/i)
			if (totalMatch) listedTotal = parseAmount(totalMatch[1])

			if (section === 'international') {
				const iof = text.match(/^repasse de iof em r\$\s+([\d.]+,\d{2})$/i)
				if (iof) {
					parsed.push({
						date: closing,
						amount: -parseAmount(iof[1]),
						description: 'Repasse de IOF (compras internacionais)',
					})
					continue
				}
			}

			// Pagamentos são transferência da conta corrente; parceladas futuras ainda não cobraram
			if (section !== 'purchases' && section !== 'international') continue

			// A data às vezes vem grudada no nome no mesmo item ("14/09 ANTHROPIC* CLAUDE")
			const dayMonth = row[0]?.text.match(LEADING_DAY_MONTH)
			// O valor é o último número da linha; marcas soltas da margem ("." e "L") vêm depois dele
			const moneyIndex = row.findLastIndex((item) => MONEY.test(item.text))
			if (!dayMonth || moneyIndex < 1) continue

			const money = row[moneyIndex]
			const description = [dayMonth[3] ?? '', ...row.slice(1, moneyIndex).map((item) => item.text)]
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim()
			if (!description) continue

			// Parcela é cobrada nesta fatura: entra na data de emissão, não na da compra original
			const isInstallment = INSTALLMENT.test(description)
			const date = isInstallment
				? closing
				: withYear(Number(dayMonth[1]), Number(dayMonth[2]), closing)

			// Na fatura a compra é positiva e o estorno negativo; no app saída é negativa
			parsed.push({ date, amount: -parseAmount(money.text), description })
		}
	}

	// Confere com o total impresso: se não bater, o layout mudou e é melhor não importar pela metade
	const sum = Math.round(parsed.reduce((acc, tx) => acc - tx.amount, 0) * 100) / 100
	const expected = listedTotal ?? (total ? parseAmount(total) : null)
	if (expected !== null && Math.abs(sum - expected) > 0.009) {
		throw new Error(
			`Fatura do Itaú: a soma dos lançamentos (${sum.toFixed(2)}) não bate com o total da fatura (${expected.toFixed(2)})`,
		)
	}

	return {
		bankName: 'Itaú',
		number: `cartão ${card}`,
		type: 'CREDIT_CARD',
		// Fatura é dívida, não saldo
		balance: null,
		balanceDate: null,
		transactions: hashIds(parsed),
	}
}
