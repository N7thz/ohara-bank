import { describe, expect, test } from 'bun:test'
import {
	day,
	localClock,
	localMonthKey,
	localMonthStart,
	localTodayKey,
	monthKey,
	monthStart,
} from './dates'

describe('datas em UTC', () => {
	test('day e monthKey usam a parte UTC', () => {
		const date = new Date('2026-03-05T00:00:00Z')
		expect(day(date)).toBe('2026-03-05')
		expect(monthKey(date)).toBe('2026-03')
	})

	test('monthStart volta para o dia 1 à meia-noite UTC', () => {
		expect(monthStart(new Date('2026-03-31T23:00:00Z')).toISOString()).toBe(
			'2026-03-01T00:00:00.000Z',
		)
	})
})

describe('horário de São Paulo (UTC−3)', () => {
	test('localClock: 02h UTC ainda é o dia anterior, 23h', () => {
		const { today, hour } = localClock(new Date('2026-03-01T02:00:00Z'))
		expect(today.toISOString()).toBe('2026-02-28T00:00:00.000Z')
		expect(hour).toBe(23)
	})

	test('22h30 do último dia do mês continua no mês atual', () => {
		const now = new Date('2026-03-01T01:30:00Z')
		expect(localTodayKey(now)).toBe('2026-02-28')
		expect(localMonthKey(now)).toBe('2026-02')
		expect(localMonthStart(now).toISOString()).toBe('2026-02-01T00:00:00.000Z')
	})

	test('00h30 já é o mês seguinte', () => {
		expect(localTodayKey(new Date('2026-03-01T03:30:00Z'))).toBe('2026-03-01')
	})
})
