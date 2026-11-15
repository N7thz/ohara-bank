import { describe, expect, test } from 'bun:test'
import {
	averageSavings,
	goalProgress,
	monthlyNeeded,
	monthsToReach,
	monthsUntil,
	savingsRate,
} from './goals'

const today = new Date('2026-11-14T00:00:00Z')

describe('goalProgress', () => {
	test('meia meta', () => {
		expect(goalProgress({ target: 1000, saved: 250 })).toEqual({ ratio: 0.25, remaining: 750 })
	})
	test('meta atingida ou passada: ratio 1 e nada falta', () => {
		expect(goalProgress({ target: 1000, saved: 1000 })).toEqual({ ratio: 1, remaining: 0 })
		expect(goalProgress({ target: 1000, saved: 1200.5 })).toEqual({ ratio: 1, remaining: 0 })
	})
	test('guardado negativo não passa de zero no ratio', () => {
		expect(goalProgress({ target: 1000, saved: -50 }).ratio).toBe(0)
	})
	test('centavos sem erro de float', () => {
		expect(goalProgress({ target: 0.3, saved: 0.1 }).remaining).toBe(0.2)
	})
})

describe('monthlyNeeded', () => {
	test('divide pelos meses contando o atual', () => {
		// nov/26 a fev/27 = 4 meses
		const targetMonth = new Date('2027-02-01T00:00:00Z')
		expect(monthsUntil(targetMonth, today)).toBe(4)
		expect(monthlyNeeded({ remaining: 1000, targetMonth, today })).toBe(250)
	})
	test('prazo no mês atual: todo o restante', () => {
		expect(
			monthlyNeeded({ remaining: 300, targetMonth: new Date('2026-11-01T00:00:00Z'), today }),
		).toBe(300)
	})
	test('prazo vencido: todo o restante', () => {
		expect(
			monthlyNeeded({ remaining: 300, targetMonth: new Date('2026-05-01T00:00:00Z'), today }),
		).toBe(300)
	})
	test('sem prazo: null', () => {
		expect(monthlyNeeded({ remaining: 300, targetMonth: null, today })).toBeNull()
	})
	test('meta já atingida: zero', () => {
		expect(
			monthlyNeeded({ remaining: 0, targetMonth: new Date('2027-02-01T00:00:00Z'), today }),
		).toBe(0)
	})
	test('arredonda no centavo', () => {
		expect(
			monthlyNeeded({ remaining: 100, targetMonth: new Date('2027-01-01T00:00:00Z'), today }),
		).toBe(33.33)
	})
})

describe('monthsToReach', () => {
	test('arredonda para cima', () => {
		expect(monthsToReach({ remaining: 1000, averageSavings: 300 })).toBe(4)
	})
	test('economia média zero ou negativa: null', () => {
		expect(monthsToReach({ remaining: 1000, averageSavings: 0 })).toBeNull()
		expect(monthsToReach({ remaining: 1000, averageSavings: -200 })).toBeNull()
	})
	test('já atingida: zero meses', () => {
		expect(monthsToReach({ remaining: 0, averageSavings: 300 })).toBe(0)
	})
})

describe('averageSavings', () => {
	const period = (start: string, income: number, expense: number, count = 5) => ({
		start,
		income,
		expense,
		count,
	})
	test('ignora o mês atual e meses sem transações, usa os 3 últimos completos', () => {
		const periods = [
			period('2026-07-01', 5000, -4000),
			period('2026-08-01', 5000, -4500),
			period('2026-09-01', 5000, -4000),
			period('2026-10-01', 6000, -4000, 0),
			period('2026-11-01', 100, -4000),
		]
		// ago 500, set 1000, jul 1000 (out vazio) → média dos 3 = 833.33
		expect(averageSavings(periods, '2026-11')).toBe(833.33)
	})
	test('sem meses completos: null', () => {
		expect(averageSavings([period('2026-11-01', 1, -1)], '2026-11')).toBeNull()
	})
	test('economia negativa', () => {
		expect(averageSavings([period('2026-10-01', 1000, -1500)], '2026-11')).toBe(-500)
	})
})

describe('savingsRate', () => {
	test('economia dos meses completos ÷ entradas', () => {
		const periods = [
			{ start: '2026-09-01', income: 5000, expense: -4000, count: 3 },
			{ start: '2026-10-01', income: 5000, expense: -4500, count: 3 },
			{ start: '2026-11-01', income: 10, expense: -4000, count: 3 },
		]
		expect(savingsRate(periods, '2026-11')).toBe(0.15)
	})
	test('sem entradas: null', () => {
		expect(savingsRate([], '2026-11')).toBeNull()
	})
})
