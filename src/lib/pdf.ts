import { getDocumentProxy } from 'unpdf'

/** Limite de páginas aceito: extratos e faturas reais têm de 2 a ~10 */
export const MAX_PDF_PAGES = 50

export interface PdfItem {
	text: string
	x: number
	y: number
	width: number
}

/** Itens da mesma altura na página, da esquerda para a direita */
export type PdfRow = PdfItem[]

// Itens com até 3pt de diferença na altura contam como a mesma linha
const ROW_TOLERANCE = 3

export function isPdf(buffer: ArrayBuffer): boolean {
	const head = new Uint8Array(buffer.slice(0, 5))
	return String.fromCharCode(...head) === '%PDF-'
}

export function center(item: PdfItem): number {
	return item.x + item.width / 2
}

/** PDF com senha (ex.: fatura do cartão Itaú): sem a senha certa não dá para ler */
export class PdfPasswordError extends Error {
	readonly needsPassword = true
	/** true quando uma senha foi enviada e estava errada */
	readonly wrongPassword: boolean

	constructor(wrongPassword: boolean) {
		super(wrongPassword ? 'Senha do PDF incorreta' : 'PDF protegido por senha')
		this.name = 'PdfPasswordError'
		this.wrongPassword = wrongPassword
	}
}

/** Texto de cada página como itens soltos, com posição; senha só para PDF protegido */
export async function readPdfItems(buffer: ArrayBuffer, password?: string): Promise<PdfItem[][]> {
	let pdf: Awaited<ReturnType<typeof getDocumentProxy>>
	try {
		pdf = await getDocumentProxy(new Uint8Array(buffer), password ? { password } : {})
	} catch (error) {
		if (error instanceof Error && error.name === 'PasswordException') {
			throw new PdfPasswordError(Boolean(password))
		}
		throw error
	}

	try {
		if (pdf.numPages > MAX_PDF_PAGES) {
			throw new Error(`PDF com mais de ${MAX_PDF_PAGES} páginas não é aceito`)
		}

		const pages: PdfItem[][] = []
		for (let number = 1; number <= pdf.numPages; number++) {
			const page = await pdf.getPage(number)
			const { items } = await page.getTextContent()

			const pdfItems: PdfItem[] = []
			for (const item of items) {
				if (!('str' in item) || !item.str.trim()) continue
				pdfItems.push({
					text: item.str.trim(),
					x: item.transform[4],
					y: item.transform[5],
					width: item.width,
				})
			}
			pages.push(pdfItems)
		}
		return pages
	} finally {
		await pdf.loadingTask.destroy()
	}
}

/** Agrupa itens da mesma altura em linhas, de cima para baixo e da esquerda para a direita */
export function groupRows(items: PdfItem[]): PdfRow[] {
	// No PDF o y cresce para cima
	const sorted = [...items].sort((a, b) => b.y - a.y)

	const rows: PdfRow[] = []
	let rowY = Number.POSITIVE_INFINITY
	for (const item of sorted) {
		if (rowY - item.y > ROW_TOLERANCE) {
			rows.push([])
			rowY = item.y
		}
		rows[rows.length - 1].push(item)
	}
	return rows.map((row) => row.sort((a, b) => a.x - b.x))
}

/** Lê o texto de cada página agrupado em linhas, de cima para baixo */
export async function readPdfRows(buffer: ArrayBuffer, password?: string): Promise<PdfRow[][]> {
	const pages = await readPdfItems(buffer, password)
	return pages.map(groupRows)
}
