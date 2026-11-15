import { center, groupRows, type PdfItem, type PdfRow, readPdfItems } from '@/lib/pdf'
import { hashIds } from './csv'
import { isItauCardStatement, parseItauCardStatement } from './itau-card-pdf'
import type { ParsedStatement, ParsedTransaction } from './types'

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/
const MONEY = /^-?\d{1,3}(\.\d{3})*,\d{2}$/

function rowText(row: PdfRow): string {
	return row.map((item) => item.text).join(' ')
}

function parseDate(text: string): Date | null {
	const match = text.match(DATE)
	if (!match) return null
	return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])))
}

// -1.335,16 → -1335.16
function parseAmount(text: string): number {
	return Number(text.replace(/\./g, '').replace(',', '.'))
}

/** Extrato da conta corrente exportado em PDF pelo app ou internet banking do Itaú */
export function isItauStatement(pages: PdfRow[][]): boolean {
	const text = (pages[0] ?? []).map(rowText).join('\n')
	return /extrato conta\s*\/\s*lançamentos/i.test(text) && /agência:\s*\d+/i.test(text)
}

/**
 * PDF do Itaú: extrato da conta corrente ou fatura do cartão (essa vem com senha, os 5
 * primeiros dígitos do CPF). null quando o PDF não é de nenhum dos dois
 */
export function parseItauStatementItems(items: PdfItem[][]): ParsedStatement | null {
	if (isItauCardStatement(items)) return parseItauCardStatement(items)

	const pages = items.map(groupRows)
	if (!isItauStatement(pages)) return null

	const firstPage = pages[0]
	const text = firstPage.map(rowText).join('\n')
	const agency = text.match(/agência:\s*(\d+)/i)?.[1]
	const account = text.match(/conta:\s*0*(\d+-\d)/i)?.[1]

	// O cabeçalho "data | lançamentos | valor (R$) | saldo (R$)" só aparece na
	// primeira página; as demais seguem as mesmas colunas
	const header = firstPage.find((row) => /valor \(R\$\)/.test(rowText(row)))
	const valueItem = header?.find((item) => /^valor/.test(item.text))
	const balanceItem = header?.find((item) => /^saldo/.test(item.text))
	if (!valueItem || !balanceItem) throw new Error('Colunas do extrato Itaú não encontradas')

	const isBalanceColumn = (item: PdfItem) =>
		Math.abs(center(item) - center(balanceItem)) < Math.abs(center(item) - center(valueItem))

	const parsed: Omit<ParsedTransaction, 'externalId'>[] = []
	let balance: number | null = null
	let balanceDate: Date | null = null

	for (const row of pages.flat()) {
		const date = parseDate(row[0]?.text ?? '')
		const money = row.find((item) => MONEY.test(item.text))
		if (!date || !money) continue

		const description = row
			.slice(1)
			.filter((item) => item !== money)
			.map((item) => item.text)
			.join(' ')

		// Lançamentos vêm do mais recente para o mais antigo: o primeiro
		// "SALDO DO DIA" é o saldo atual da conta
		if (/^SALDO DO DIA$/i.test(description) || isBalanceColumn(money)) {
			if (balanceDate === null) {
				balance = parseAmount(money.text)
				balanceDate = date
			}
			continue
		}

		parsed.push({ date, amount: parseAmount(money.text), description })
	}

	return {
		bankName: 'Itaú',
		number: agency && account ? `${agency}/${account}` : 'conta',
		type: 'CHECKING',
		balance,
		balanceDate,
		transactions: hashIds(parsed),
	}
}

export async function parseItauStatementPdf(
	buffer: ArrayBuffer,
	password?: string,
): Promise<ParsedStatement | null> {
	return parseItauStatementItems(await readPdfItems(buffer, password))
}
