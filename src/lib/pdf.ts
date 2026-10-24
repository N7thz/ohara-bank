import { getDocumentProxy } from 'unpdf'

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

/** Lê o texto de cada página agrupado em linhas, de cima para baixo */
export async function readPdfRows(buffer: ArrayBuffer): Promise<PdfRow[][]> {
	const pdf = await getDocumentProxy(new Uint8Array(buffer))
	const pages: PdfRow[][] = []

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

		// No PDF o y cresce para cima
		pdfItems.sort((a, b) => b.y - a.y)

		const rows: PdfRow[] = []
		let rowY = Number.POSITIVE_INFINITY
		for (const item of pdfItems) {
			if (rowY - item.y > ROW_TOLERANCE) {
				rows.push([])
				rowY = item.y
			}
			rows[rows.length - 1].push(item)
		}

		pages.push(rows.map((row) => row.sort((a, b) => a.x - b.x)))
	}

	return pages
}
