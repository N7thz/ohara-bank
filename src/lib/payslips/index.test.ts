import { describe, expect, test } from 'bun:test'
import type { PdfRow } from '@/lib/pdf'
import { parsePayslipRows } from './index'

const item = (text: string, x: number): PdfRow[number] => ({ text, x, y: 0, width: 20 })

// Holerite sintético (empregador e CNPJ inventados): salário de 1.000,00 com desconto de 100,00
function payslipRows(title: string, competence: string, itemDescription = 'SALARIO'): PdfRow[][] {
	return [
		[
			[item(title, 0)],
			[item('EMPRESA TESTE LTDA', 0), item('CNPJ', 200), item('12.345.678/0001-90', 240)],
			[item('Competência', 0), item(competence, 100)],
			[
				item('Código', 0),
				item('Descrição', 50),
				item('Referência', 150),
				item('Proventos', 250),
				item('Descontos', 350),
			],
			[item('1', 0), item(itemDescription, 50), item('30,00', 150), item('1.000,00', 250)],
			[item('2', 0), item('INSS', 50), item('10,00', 150), item('100,00', 350)],
			[item('Total de Proventos', 250), item('Total de Descontos', 350)],
			[item('1.000,00', 250), item('100,00', 350)],
			[item('Valor Líquido', 250), item('900,00', 350)],
		],
	]
}

describe('parsePayslipRows', () => {
	test('competência 10/2026 é um holerite mensal', () => {
		const parsed = parsePayslipRows(payslipRows('RECIBO DE PAGAMENTO DE SALÁRIO', '10/2026'))
		expect(parsed.kind).toBe('MONTHLY')
		expect(parsed.competence).toEqual(new Date(Date.UTC(2026, 9, 1)))
		expect(parsed.netAmount).toBe(900)
	})

	test('competência 13/2026 vira dezembro e 13º salário', () => {
		const parsed = parsePayslipRows(payslipRows('RECIBO DE PAGAMENTO DE SALÁRIO', '13/2026'))
		expect(parsed.kind).toBe('THIRTEENTH')
		expect(parsed.competence).toEqual(new Date(Date.UTC(2026, 11, 1)))
	})

	test('título com "FÉRIAS" é holerite de férias', () => {
		const parsed = parsePayslipRows(payslipRows('RECIBO DE PAGAMENTO DE FÉRIAS', '10/2026'))
		expect(parsed.kind).toBe('VACATION')
	})

	test('"férias" numa verba de holerite mensal não muda o tipo', () => {
		const parsed = parsePayslipRows(
			payslipRows('RECIBO DE PAGAMENTO DE SALÁRIO', '10/2026', 'ADIC FERIAS'),
		)
		expect(parsed.kind).toBe('MONTHLY')
	})
})
