import { createHash } from 'node:crypto'
import type { AccountType, ParsedStatement, ParsedTransaction, StatementOptions } from './types'

function splitLine(line: string, separator: string): string[] {
	const cells: string[] = []
	let current = ''
	let quoted = false

	for (const char of line) {
		if (char === '"') quoted = !quoted
		else if (char === separator && !quoted) {
			cells.push(current.trim())
			current = ''
		} else current += char
	}
	cells.push(current.trim())

	return cells
}

function normalize(header: string): string {
	return header
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/\(.*?\)/g, '')
		.replace(/[^a-z0-9 ]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

// "15/10/2026", "15/10/26", "15-10-2026" ou "2026-10-15"
function parseDate(value: string): Date | null {
	const br = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/)
	if (br) {
		const year = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3])
		return new Date(Date.UTC(year, Number(br[2]) - 1, Number(br[1])))
	}

	const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
	if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))

	return null
}

// "1.234,56", "-1234.56", "R$ 10,00", "(10,00)" ou "10,00 D"
function parseAmount(value: string): number | null {
	let clean = value.replace(/R\$|\s/g, '')
	if (!clean) return null

	let sign = 1
	if (/^\(.*\)$/.test(clean)) {
		sign = -1
		clean = clean.slice(1, -1)
	}
	if (/[Dd]$/.test(clean)) {
		sign = -1
		clean = clean.slice(0, -1)
	} else if (/[Cc]$/.test(clean)) {
		clean = clean.slice(0, -1)
	}

	// Vírgula depois do último ponto = decimal brasileiro
	const amount =
		clean.lastIndexOf(',') > clean.lastIndexOf('.')
			? Number(clean.replace(/\./g, '').replace(',', '.'))
			: Number(clean.replace(/,/g, ''))

	return Number.isFinite(amount) ? sign * amount : null
}

// CSV sem ID por transação: o hash inclui a ocorrência para não fundir
// compras iguais no mesmo dia, e é estável se o mesmo arquivo for reimportado
export function hashIds(rows: Omit<ParsedTransaction, 'externalId'>[]): ParsedTransaction[] {
	const seen = new Map<string, number>()

	return rows.map((row) => {
		const key = `${row.date.toISOString().slice(0, 10)}|${row.amount}|${row.description}`
		const occurrence = seen.get(key) ?? 0
		seen.set(key, occurrence + 1)

		const externalId = createHash('sha1').update(`${key}|${occurrence}`).digest('hex')
		return { ...row, externalId }
	})
}

// O Nubank repete o identificador no "Pix no Crédito": a entrada do cartão e a
// saída do Pix vêm com o mesmo id. O OFX do Nubank marca a segunda com
// ":reversal"; segue o mesmo padrão para o CSV e o OFX da conta baterem.
function uniqueIds(transactions: ParsedTransaction[]): ParsedTransaction[] {
	const seen = new Map<string, number>()

	return transactions.map((tx) => {
		const occurrence = seen.get(tx.externalId) ?? 0
		seen.set(tx.externalId, occurrence + 1)

		if (occurrence === 0) return tx
		const suffix = occurrence === 1 ? ':reversal' : `:reversal:${occurrence}`
		return { ...tx, externalId: `${tx.externalId}${suffix}` }
	})
}

// NU_386835623_01SET2026_30SET2026.csv → 38683562-3 (mesmo número do OFX)
function nubankAccountNumber(fileName: string | undefined): string {
	const digits = fileName?.match(/^NU_(\d+)_/i)?.[1]
	return digits ? `${digits.slice(0, -1)}-${digits.slice(-1)}` : 'conta'
}

// Nomes de coluna usados pelos bancos, já normalizados (sem acento, minúsculo)
const COLUMNS = {
	date: [
		'data',
		'date',
		'data lancamento',
		'data de lancamento',
		'data da transacao',
		'data movimento',
		'data mov',
		'dt lancamento',
		'data compra',
	],
	description: [
		'descricao',
		'description',
		'historico',
		'lancamento',
		'lancamentos',
		'title',
		'titulo',
		'memo',
		'estabelecimento',
		'detalhes',
		'detalhe',
		'nome',
		'transacao',
	],
	amount: [
		'valor',
		'amount',
		'valor r',
		'quantia',
		'montante',
		'valor lancamento',
		'valor da transacao',
	],
	credit: ['credito', 'creditos', 'entrada', 'entradas', 'valor credito'],
	debit: ['debito', 'debitos', 'saida', 'saidas', 'valor debito'],
	kind: ['tipo', 'natureza', 'd c', 'dc', 'c d', 'cd', 'tipo lancamento'],
	id: ['identificador', 'id', 'fitid', 'id transacao'],
}

type Column = keyof typeof COLUMNS

function findColumns(headers: string[]) {
	const find = (column: Column) => headers.findIndex((h) => COLUMNS[column].includes(h))
	return {
		date: find('date'),
		description: find('description'),
		amount: find('amount'),
		credit: find('credit'),
		debit: find('debit'),
		kind: find('kind'),
		id: find('id'),
	}
}

// Alguns bancos colocam linhas de título (nome, agência, período) antes do cabeçalho
function findHeader(lines: string[]) {
	for (const [index, line] of lines.slice(0, 20).entries()) {
		const separator = line.split(';').length > line.split(',').length ? ';' : ','
		const headers = splitLine(line, separator).map(normalize)
		const columns = findColumns(headers)
		const hasValue = columns.amount >= 0 || columns.credit >= 0 || columns.debit >= 0

		if (columns.date >= 0 && hasValue) return { index, separator, headers, columns }
	}
	return null
}

function parseNubank(
	headers: string[],
	rows: string[][],
	fileName?: string,
): ParsedStatement | null {
	const col = (name: string) => headers.indexOf(name)

	// Nubank conta: Data,Valor,Identificador,Descrição
	if (col('data') >= 0 && col('valor') >= 0 && col('identificador') >= 0) {
		const transactions: ParsedTransaction[] = []

		for (const row of rows) {
			const date = parseDate(row[col('data')] ?? '')
			const amount = parseAmount(row[col('valor')] ?? '')
			if (!date || amount === null) continue

			transactions.push({
				externalId: row[col('identificador')],
				date,
				amount,
				description: row[col('descricao')] || 'Sem descrição',
			})
		}

		return {
			bankName: 'Nubank',
			number: nubankAccountNumber(fileName),
			type: 'CHECKING',
			balance: null,
			balanceDate: null,
			transactions: uniqueIds(transactions),
		}
	}

	// Nubank cartão: date,title,amount (compra positiva, pagamento negativo)
	if (headers.length === 3 && col('date') >= 0 && col('title') >= 0 && col('amount') >= 0) {
		const parsed: Omit<ParsedTransaction, 'externalId'>[] = []

		for (const row of rows) {
			const date = parseDate(row[col('date')] ?? '')
			const amount = parseAmount(row[col('amount')] ?? '')
			if (!date || amount === null) continue

			parsed.push({ date, amount: -amount, description: row[col('title')] || 'Sem descrição' })
		}

		return {
			bankName: 'Nubank',
			number: 'cartao',
			type: 'CREDIT_CARD',
			balance: null,
			balanceDate: null,
			transactions: hashIds(parsed),
		}
	}

	return null
}

function amountFromRow(row: string[], columns: ReturnType<typeof findColumns>): number | null {
	if (columns.amount >= 0) {
		const amount = parseAmount(row[columns.amount] ?? '')
		if (amount === null) return null

		// Coluna "Tipo" com D/C ou Débito/Crédito define o sinal
		const kind = normalize(row[columns.kind] ?? '')
		if (/^(d|debito|saida)/.test(kind)) return -Math.abs(amount)
		if (/^(c|credito|entrada)/.test(kind)) return Math.abs(amount)
		return amount
	}

	// Colunas separadas de crédito e débito
	const credit = parseAmount(row[columns.credit] ?? '')
	const debit = parseAmount(row[columns.debit] ?? '')
	if (credit === null && debit === null) return null
	return Math.abs(credit ?? 0) - Math.abs(debit ?? 0)
}

export class MissingAccountInfoError extends Error {
	constructor() {
		super('Informe o banco e o tipo de conta deste CSV')
	}
}

export function parseCsv(content: string, options: StatementOptions = {}): ParsedStatement {
	const lines = content.split(/\r?\n/).filter((line) => line.trim())
	if (lines.length === 0) throw new Error('Arquivo CSV vazio')

	const header = findHeader(lines)
	if (!header) {
		throw new Error(
			'Não encontrei as colunas de data e valor no CSV. Confira se o arquivo tem cabeçalho.',
		)
	}

	const { index, separator, headers, columns } = header
	const rows = lines.slice(index + 1).map((line) => splitLine(line, separator))

	const nubank = parseNubank(headers, rows, options.fileName)
	if (nubank && !options.bankName) return nubank

	const { bankName, type } = options
	if (!bankName || !type) throw new MissingAccountInfoError()

	const parsed: Omit<ParsedTransaction, 'externalId'>[] = []
	const ids: (string | undefined)[] = []

	for (const row of rows) {
		const date = parseDate(row[columns.date] ?? '')
		const amount = amountFromRow(row, columns)
		// Linhas de saldo, totais e rodapé não têm data ou valor válidos
		if (!date || amount === null || amount === 0) continue

		const description =
			(columns.description >= 0 ? row[columns.description] : '') || 'Sem descrição'
		if (/^saldo\b/i.test(normalize(description))) continue

		parsed.push({ date, amount, description })
		ids.push(columns.id >= 0 ? row[columns.id] || undefined : undefined)
	}

	// Na fatura do cartão a maioria dos bancos lista compras como positivas
	const flip =
		type === 'CREDIT_CARD' && parsed.filter((tx) => tx.amount > 0).length > parsed.length / 2
	const signed = flip ? parsed.map((tx) => ({ ...tx, amount: -tx.amount })) : parsed

	const hashed = hashIds(signed)
	const transactions = uniqueIds(
		hashed.map((tx, i) => ({ ...tx, externalId: ids[i] ?? tx.externalId })),
	)

	return {
		bankName,
		number: options.number || (type === 'CREDIT_CARD' ? 'cartao' : 'conta'),
		type: type as AccountType,
		balance: null,
		balanceDate: null,
		transactions,
	}
}
