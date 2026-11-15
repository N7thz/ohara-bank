import { describe, expect, test } from 'bun:test'
import { absMoney, divideMoney, sumMoney, toMoney, toReais } from './money'

describe('toMoney / toReais', () => {
	test.each([
		[10.1, 10.1],
		['123.45', 123.45],
		[-0.01, -0.01],
		[0, 0],
	])('%p → %p', (input, expected) => {
		expect(toReais(toMoney(input))).toBe(expected)
	})

	test('aceita Decimal do Prisma (qualquer objeto com toString)', () => {
		expect(toReais(toMoney({ toString: () => '99.90' }))).toBe(99.9)
	})
})

describe('contas em centavos', () => {
	test('soma sem erro de float', () => {
		expect(toReais(sumMoney([toMoney(0.1), toMoney(0.2)]))).toBe(0.3)
	})

	test('soma vazia é zero', () => {
		expect(toReais(sumMoney([]))).toBe(0)
	})

	test('divide arredondando no centavo', () => {
		expect(toReais(divideMoney(toMoney(100), 3))).toBe(33.33)
	})

	test('valor absoluto', () => {
		expect(toReais(absMoney(toMoney(-5.5)))).toBe(5.5)
	})
})
