import { describe, expect, test } from 'bun:test'
import { csvCell, csvTextCell } from './csv-cell'

describe('csvTextCell', () => {
	test.each([
		['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
		['+55 11', "'+55 11"],
		['-PIX', "'-PIX"],
		['@SUM(A1)', "'@SUM(A1)"],
		['\tX', "'\tX"],
		['\rX', `"'\rX"`],
		['Padaria', 'Padaria'],
		['a;b', '"a;b"'],
	])('%j → %j', (input, expected) => {
		expect(csvTextCell(input)).toBe(expected)
	})
})

describe('csvCell', () => {
	test('valor negativo fica intacto', () => {
		expect(csvCell('-10,50')).toBe('-10,50')
	})
})
