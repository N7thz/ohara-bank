import { describe, expect, test } from 'bun:test'

// match.ts importa o Prisma, que exige DATABASE_URL ao carregar (nenhuma consulta é feita aqui)
process.env.DATABASE_URL ??= 'postgresql://teste@localhost:5432/teste'
const { assignPayments, splitPattern } = await import('./match')
const { debtInputSchema } = await import('@/app/api/finance/debts/schema')

const expense = (id: string, text: string, date = '2026-09-10') => ({
	id,
	date: new Date(`${date}T00:00:00Z`),
	accountId: 'conta',
	amount: 50,
	description: text,
	text,
})

const debt = (id: string, pattern: string, startMonth = '2026-01-01') => ({
	id,
	pattern,
	startMonth: new Date(`${startMonth}T00:00:00Z`),
})

describe('splitPattern', () => {
	test('descarta trechos com menos de 3 letras', () => {
		expect(splitPattern('Luz|a| vivo-RJ ')).toEqual(['luz', 'vivo-rj'])
	})
})

describe('assignPayments', () => {
	test('transação que casa com duas dívidas fica com o trecho mais longo', () => {
		const owned = assignPayments(
			[debt('a', 'vivo'), debt('b', 'telefonica|vivo-rj')],
			[expense('t1', 'pagamento vivo-rj')],
		)
		expect([...(owned.get('a') ?? [])]).toEqual([])
		expect([...(owned.get('b') ?? [])]).toEqual(['t1'])
	})

	test('empate fica com a primeira dívida', () => {
		const owned = assignPayments([debt('a', 'loja'), debt('b', 'loja')], [expense('t1', 'loja x')])
		expect([...(owned.get('a') ?? [])]).toEqual(['t1'])
		expect([...(owned.get('b') ?? [])]).toEqual([])
	})

	test('antes do início da dívida não conta', () => {
		const owned = assignPayments([debt('a', 'loja', '2026-10-01')], [expense('t1', 'loja x')])
		expect([...(owned.get('a') ?? [])]).toEqual([])
	})
})

describe('debtInputSchema', () => {
	const valid = {
		name: 'Luz',
		kind: 'RECURRING',
		amount: 100,
		dueDay: 10,
		installments: null,
		startMonth: '2026-01',
		pattern: 'enel distri',
	}

	test('aceita padrão com trechos de 3+ letras', () => {
		expect(debtInputSchema.safeParse(valid).success).toBe(true)
	})

	test('recusa trecho curto como "a"', () => {
		expect(debtInputSchema.safeParse({ ...valid, pattern: 'luz|a' }).success).toBe(false)
	})
})
