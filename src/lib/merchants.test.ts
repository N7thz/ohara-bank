import { describe, expect, test } from 'bun:test'
import { merchantKey, merchantName } from './merchants'

describe('merchantName', () => {
	test.each([
		['Compra no débito - PADARIA EXEMPLO', 'PADARIA EXEMPLO'],
		['MP *BARBEARIA X', 'BARBEARIA X'],
		['IFD*LANCHONETE Y', 'LANCHONETE Y'],
	])('%p → %p', (description, expected) => {
		expect(merchantName(description)).toBe(expected)
	})
})

describe('merchantKey', () => {
	test('minúsculo, sem acento e com espaços simples', () => {
		expect(merchantKey('Padaria  São João')).toBe('padaria sao joao')
	})
})
