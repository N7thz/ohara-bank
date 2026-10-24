import { center, type PdfItem, type PdfRow, readPdfRows } from '@/lib/pdf'

export type PayslipItemKind = 'EARNING' | 'DEDUCTION'

export interface ParsedPayslipItem {
	code: string
	description: string
	reference: string | null
	kind: PayslipItemKind
	amount: number
}

export interface ParsedPayslip {
	employerName: string
	employerCnpj: string
	/** Primeiro dia do mês de competência (UTC) */
	competence: Date
	grossAmount: number
	deductionsAmount: number
	netAmount: number
	fgtsAmount: number | null
	items: ParsedPayslipItem[]
}

const MONEY = /^-?\d{1,3}(\.\d{3})*,\d{2}$/
const CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/

// 2.638,22 → 263822 (centavos, para comparar totais sem erro de float)
function toCents(text: string): number {
	return Number(text.replace(/\./g, '').replace(',', ''))
}

function rowText(row: PdfRow): string {
	return row.map((item) => item.text).join(' ')
}

function findRow(rows: PdfRow[], pattern: RegExp): number {
	return rows.findIndex((row) => pattern.test(rowText(row)))
}

function findItem(row: PdfRow, pattern: RegExp): PdfItem | undefined {
	return row.find((item) => pattern.test(item.text))
}

// Cada valor pertence à coluna cujo título está mais perto na horizontal
function nearestColumn<T extends string>(item: PdfItem, columns: Record<T, number>): T {
	let best: T | null = null
	for (const name in columns) {
		if (
			best === null ||
			Math.abs(center(item) - columns[name]) < Math.abs(center(item) - columns[best])
		) {
			best = name
		}
	}
	return best as T
}

function columnCenters<T extends string>(row: PdfRow, titles: Record<T, RegExp>) {
	const centers = {} as Record<T, number>
	for (const name in titles) {
		const item = findItem(row, titles[name])
		if (!item) throw new Error('Layout de holerite não reconhecido')
		centers[name] = center(item)
	}
	return centers
}

/** Holerite no layout "RECIBO DE PAGAMENTO DE SALÁRIO" */
export function isPayslip(pages: PdfRow[][]): boolean {
	return findRow(pages[0] ?? [], /RECIBO DE PAGAMENTO/i) >= 0
}

function parseItems(rows: PdfRow[], start: number, end: number): ParsedPayslipItem[] {
	const columns = columnCenters(rows[start], {
		description: /^Descrição$/i,
		reference: /^Referência$/i,
		earning: /^Proventos$/i,
		deduction: /^Descontos$/i,
	})

	const items: ParsedPayslipItem[] = []

	for (const row of rows.slice(start + 1, end)) {
		// O código é o número no começo da linha; a descrição, alinhada à esquerda,
		// fica mais perto do título "Código" do que do "Descrição"
		const code = /^\d+$/.test(row[0].text) ? row[0].text : ''
		const values = { description: [], reference: [], earning: [], deduction: [] } as Record<
			keyof typeof columns,
			string[]
		>
		for (const item of code ? row.slice(1) : row)
			values[nearestColumn(item, columns)].push(item.text)

		const description = values.description.join(' ')
		const amount = [...values.earning, ...values.deduction].find((text) => MONEY.test(text))

		if (/^\d+$/.test(code) && description) {
			items.push({
				code,
				description,
				reference: values.reference.join(' ') || null,
				kind: values.deduction.length > 0 ? 'DEDUCTION' : 'EARNING',
				amount: amount ? toCents(amount) : 0,
			})
			continue
		}

		// O valor às vezes fica numa linha só dele, logo abaixo da descrição
		const last = items.at(-1)
		if (!code && !description && amount && last && last.amount === 0) {
			last.amount = toCents(amount)
			last.kind = values.deduction.length > 0 ? 'DEDUCTION' : 'EARNING'
		}
	}

	return items
}

export async function parsePayslip(buffer: ArrayBuffer): Promise<ParsedPayslip> {
	const pages = await readPdfRows(buffer)
	const rows = pages[0] ?? []

	if (!isPayslip(pages)) {
		throw new Error('PDF não reconhecido: em PDF são aceitos extrato do Itaú e holerite')
	}

	const text = rows.map(rowText).join('\n')

	const employerCnpj = text.match(CNPJ)?.[0]
	if (!employerCnpj) throw new Error('CNPJ do empregador não encontrado no holerite')

	// Nome da empresa: o que está à esquerda do rótulo CNPJ/CEI na mesma linha
	const cnpjRow = rows[findRow(rows, /CNPJ/i)]
	const cnpjLabel = cnpjRow && findItem(cnpjRow, /CNPJ/i)
	const employerName = cnpjRow
		?.filter((item) => cnpjLabel && item.x < cnpjLabel.x)
		.map((item) => item.text)
		.join(' ')
	if (!employerName) throw new Error('Nome do empregador não encontrado no holerite')

	// Competência MM/AAAA (a data de admissão é DD/MM/AAAA e fica de fora)
	const competenceMatch = rows
		.flat()
		.map((item) => item.text.match(/^(0[1-9]|1[0-2])\/(\d{4})$/))
		.find(Boolean)
	if (!competenceMatch) throw new Error('Competência não encontrada no holerite')
	const competence = new Date(
		Date.UTC(Number(competenceMatch[2]), Number(competenceMatch[1]) - 1, 1),
	)

	const itemsStart = findRow(rows, /Código.*Descrição/i)
	const totalsTitle = findRow(rows, /Total de Proventos/i)
	if (itemsStart < 0 || totalsTitle < 0) throw new Error('Layout de holerite não reconhecido')

	const items = parseItems(rows, itemsStart, totalsTitle)
	if (items.length === 0) throw new Error('Nenhuma verba encontrada no holerite')

	// Totais: valores na linha logo abaixo dos títulos "Total de Proventos/Descontos"
	const totalColumns = columnCenters(rows[totalsTitle], {
		gross: /Total de Proventos/i,
		deductions: /Total de Descontos/i,
	})
	const totals = { gross: 0, deductions: 0 }
	for (const item of rows[totalsTitle + 1] ?? []) {
		if (MONEY.test(item.text)) totals[nearestColumn(item, totalColumns)] = toCents(item.text)
	}

	const netRow = rows[findRow(rows, /Valor Líquido/i)]
	const net = netRow?.map((item) => item.text).find((value) => MONEY.test(value))
	if (!net) throw new Error('Valor líquido não encontrado no holerite')
	const netAmount = toCents(net)

	// Rodapé: valores logo abaixo de "F.G.T.S do Mês"
	const footerTitle = findRow(rows, /F\.?G\.?T\.?S/i)
	let fgtsAmount: number | null = null
	if (footerTitle >= 0) {
		const fgtsTitle = findItem(rows[footerTitle], /F\.?G\.?T\.?S do Mês/i)
		const values = (rows[footerTitle + 1] ?? []).filter((item) => MONEY.test(item.text))
		const fgts =
			fgtsTitle &&
			values.reduce<PdfItem | null>(
				(best, item) =>
					!best ||
					Math.abs(center(item) - center(fgtsTitle)) < Math.abs(center(best) - center(fgtsTitle))
						? item
						: best,
				null,
			)
		if (fgts) fgtsAmount = toCents(fgts.text)
	}

	const sum = (kind: PayslipItemKind) =>
		items.filter((item) => item.kind === kind).reduce((total, item) => total + item.amount, 0)
	const grossAmount = totals.gross || sum('EARNING')
	const deductionsAmount = totals.deductions || sum('DEDUCTION')

	// Confere a leitura: as verbas têm que fechar com os totais e o líquido
	if (
		sum('EARNING') !== grossAmount ||
		sum('DEDUCTION') !== deductionsAmount ||
		grossAmount - deductionsAmount !== netAmount
	) {
		throw new Error('Os valores do holerite não fecham com os totais; o layout pode ser diferente')
	}

	const toReais = (cents: number) => cents / 100

	return {
		employerName,
		employerCnpj,
		competence,
		grossAmount: toReais(grossAmount),
		deductionsAmount: toReais(deductionsAmount),
		netAmount: toReais(netAmount),
		fgtsAmount: fgtsAmount === null ? null : toReais(fgtsAmount),
		items: items.map((item) => ({ ...item, amount: toReais(item.amount) })),
	}
}
