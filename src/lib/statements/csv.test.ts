import { describe, expect, test } from 'bun:test'
import { hashIds, MissingAccountInfoError, parseCsv } from './csv'

const NUBANK_CONTA = [
	'Data,Valor,Identificador,Descrição',
	'01/09/2026,-25.50,aaa-111,Compra no débito - PADARIA EXEMPLO',
	'02/09/2026,1500.00,bbb-222,Transferência recebida pelo Pix - FULANA DE TESTE',
	'02/09/2026,-1500.00,bbb-222,Pix no Crédito',
].join('\n')

describe('Nubank conta', () => {
	const statement = parseCsv(NUBANK_CONTA, { fileName: 'NU_123456789_01SET2026_30SET2026.csv' })

	test('identifica banco, conta e tipo', () => {
		expect(statement.bankName).toBe('Nubank')
		expect(statement.number).toBe('12345678-9')
		expect(statement.type).toBe('CHECKING')
	})

	test('usa o identificador do arquivo; o repetido ganha :reversal', () => {
		expect(statement.transactions.map((tx) => tx.externalId)).toEqual([
			'aaa-111',
			'bbb-222',
			'bbb-222:reversal',
		])
	})

	test('valores e datas à meia-noite UTC', () => {
		expect(statement.transactions[0].amount).toBe(-25.5)
		expect(statement.transactions[0].date.toISOString()).toBe('2026-09-01T00:00:00.000Z')
	})
})

describe('Nubank cartão', () => {
	const statement = parseCsv(
		[
			'date,title,amount',
			'2026-09-03,Loja Exemplo,49.90',
			'2026-09-10,Pagamento recebido,-200.00',
		].join('\n'),
	)

	test('compra vira saída e pagamento vira entrada', () => {
		expect(statement.type).toBe('CREDIT_CARD')
		expect(statement.number).toBe('cartao')
		expect(statement.transactions.map((tx) => tx.amount)).toEqual([-49.9, 200])
	})
})

describe('hashIds', () => {
	const row = { date: new Date('2026-09-01T00:00:00Z'), amount: -10, description: 'Café' }

	test('id estável: mudar a fórmula duplicaria transações ao reimportar', () => {
		expect(hashIds([row])[0].externalId).toBe('67379bafbc9eb5ba4defdf6ed317558b8be2832d')
	})

	test('duas compras iguais no mesmo dia recebem ids diferentes', () => {
		const [first, second] = hashIds([row, { ...row }])
		expect(first.externalId).not.toBe(second.externalId)
	})

	test('mesmo conteúdo, mesmos ids', () => {
		expect(hashIds([row, row]).map((tx) => tx.externalId)).toEqual(
			hashIds([row, row]).map((tx) => tx.externalId),
		)
	})
})

describe('CSV genérico', () => {
	const content = [
		'Banco X - extrato',
		'Data;Descrição;Valor',
		'01/09/2026;Saldo anterior;100,00',
		'02/09/2026;Mercado;"1.234,56"',
		'03/09/2026;Estorno;(10,00)',
		'04/09/2026;Tarifa;10,00 D',
	].join('\n')

	test('sem banco e tipo pede as informações', () => {
		expect(() => parseCsv(content)).toThrow(MissingAccountInfoError)
	})

	test('formatos brasileiros de valor e linha de saldo ignorada', () => {
		const statement = parseCsv(content, { bankName: 'Banco X', type: 'CHECKING' })
		expect(statement.transactions.map((tx) => [tx.description, tx.amount])).toEqual([
			['Mercado', 1234.56],
			['Estorno', -10],
			['Tarifa', -10],
		])
	})

	test('cartão com maioria positiva inverte os sinais', () => {
		const card = [
			'Data;Descrição;Valor',
			'01/09/2026;Loja A;50,00',
			'02/09/2026;Loja B;20,00',
		].join('\n')
		const statement = parseCsv(card, { bankName: 'Banco X', type: 'CREDIT_CARD' })
		expect(statement.transactions.map((tx) => tx.amount)).toEqual([-50, -20])
	})

	const generic = (rows: string[], header = 'Data;Descrição;Valor') =>
		parseCsv([header, ...rows].join('\n'), { bankName: 'Banco X', type: 'CHECKING' })

	test.each([
		['1.234', 1234],
		['1.234.567', 1234567],
		['12.50', 12.5],
		['"1,234.56"', 1234.56],
		['10,00-', -10],
	])('valor %p → %p', (value, expected) => {
		expect(generic([`01/09/2026;Item;${value}`]).transactions[0].amount).toBe(expected)
	})

	test('coluna Tipo só decide o sinal com valores exatos', () => {
		const statement = generic(
			['01/09/2026;Loja;50,00;Compra', '02/09/2026;Tarifa;10,00;Débito', '03/09/2026;Pix;20,00;C'],
			'Data;Descrição;Valor;Tipo',
		)
		expect(statement.transactions.map((tx) => tx.amount)).toEqual([50, -10, 20])
	})

	test('quebra de linha dentro de aspas não quebra a linha', () => {
		const statement = generic(['01/09/2026;"Linha 1\nLinha 2";30,00', '02/09/2026;Outra;5,00'])
		expect(statement.transactions).toHaveLength(2)
		expect(statement.transactions[0].amount).toBe(30)
	})
})
