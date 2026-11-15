import { describe, expect, test } from 'bun:test'
import { currencyInput, formatCurrencyInput, parseCurrency } from './currency-input'

describe('parseCurrency', () => {
	test.each([
		['1.234,56', 1234.56],
		['10', 10],
		['0,5', 0.5],
	])('%p → %p', (input, expected) => {
		expect(parseCurrency(input)).toBe(expected)
	})

	test('texto inválido vira NaN', () => {
		expect(parseCurrency('abc')).toBeNaN()
	})
})

describe('currencyInput', () => {
	test('número → texto com vírgula e 2 casas', () => {
		expect(currencyInput(1234.5)).toBe('1234,50')
	})
})

describe('formatCurrencyInput', () => {
	test('deixa só dígitos, ponto e vírgula', () => {
		expect(formatCurrencyInput('R$ 1.234,5a')).toBe('1.234,5')
	})
})
