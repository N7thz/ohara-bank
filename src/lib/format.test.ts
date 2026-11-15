import { describe, expect, test } from 'bun:test'
import { formatCurrency } from './format'

describe('formatCurrency', () => {
	test('formata em reais', () => {
		// toLocaleString usa espaço não separável (U+00A0) entre "R$" e o número
		expect(formatCurrency(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
	})

	test('negativo', () => {
		expect(formatCurrency(-10).replace(/\s/g, ' ')).toBe('-R$ 10,00')
	})
})
