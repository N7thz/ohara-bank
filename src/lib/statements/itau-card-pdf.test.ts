import { describe, expect, test } from 'bun:test'
import type { PdfItem } from '@/lib/pdf'
import { isItauCardStatement, parseItauCardStatement } from './itau-card-pdf'

// Itens de texto montados à mão no lugar de um PDF real (sem dados pessoais)
const item = (text: string, x: number, y: number): PdfItem => ({
	text,
	x,
	y,
	width: text.length * 4,
})

/** Uma linha: data, descrição e valor nas posições de uma coluna da fatura */
const row = (column: number, y: number, date: string, description: string, value: string) => [
	item(date, column, y),
	item(description, column + 28, y),
	item(value, column + 180, y),
]

function invoice(listedTotal: string): PdfItem[][] {
	const firstPage = [
		item('Resumo da fatura em R$', 450, 730),
		item('Cartão', 70, 620),
		item('4705.XXXX.XXXX.1234', 97, 620),
		item('Emissão: 29/10/2026', 300, 600),
		item(`L Lançamentos atuais ${listedTotal}`, 300, 580),
	]
	const left = 133
	const right = 351
	const secondPage = [
		item('Pagamentos efetuados', left, 720),
		...row(left, 700, '02/10', 'Pagamento via conta', '-50,00'),
		item('Lançamentos: compras e saques', left, 660),
		...row(left, 640, '15/10', 'LOJA A', '30,00'),
		...row(left, 620, '16/10', 'LOJA B', '40,00'),
		...row(left, 600, '17/10', 'LOJA A ESTORNO', '-10,00'),
		item('Lançamentos: compras e saques', right, 720),
		...row(right, 700, '10/08', 'LOJA PARCELADA 02/05', '40,00'),
		item('Compras parceladas - próximas faturas', right, 660),
		...row(right, 640, '10/08', 'LOJA PARCELADA 03/05', '40,00'),
	]
	return [firstPage, secondPage]
}

describe('fatura do cartão Itaú', () => {
	test('reconhece pela primeira página', () => {
		expect(isItauCardStatement(invoice('100,00'))).toBe(true)
		expect(isItauCardStatement([[item('Extrato conta / lançamentos', 100, 700)]])).toBe(false)
	})

	const statement = parseItauCardStatement(invoice('100,00'))

	test('conta do cartão pelo final do número', () => {
		expect(statement.type).toBe('CREDIT_CARD')
		expect(statement.number).toBe('cartão 1234')
		expect(statement.balance).toBeNull()
	})

	test('compras viram saídas, estorno vira entrada; pagamento e parcelas futuras ficam de fora', () => {
		expect(statement.transactions.map((tx) => [tx.description, tx.amount])).toEqual([
			['LOJA A', -30],
			['LOJA B', -40],
			['LOJA A ESTORNO', 10],
			['LOJA PARCELADA 02/05', -40],
		])
	})

	test('compra com o ano do fechamento; parcela na data de emissão', () => {
		expect(statement.transactions[0].date.toISOString().slice(0, 10)).toBe('2026-10-15')
		expect(statement.transactions[3].date.toISOString().slice(0, 10)).toBe('2026-10-29')
	})

	test('recusa a fatura quando a soma não bate com o total impresso', () => {
		expect(() => parseItauCardStatement(invoice('999,00'))).toThrow('não bate')
	})
})
