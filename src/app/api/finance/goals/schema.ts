import { z } from 'zod'
import { monthKey } from '@/lib/dates'
import { goalProgress, monthlyNeeded } from '@/lib/goals'
import { toMoney, toReais } from '@/lib/money'

export const goalInputSchema = z.object({
	name: z.string().trim().min(1).max(60),
	targetAmount: z.number().positive().max(1_000_000_000),
	/** AAAA-MM; null/ausente = sem prazo */
	targetMonth: z
		.string()
		.regex(/^\d{4}-(0[1-9]|1[0-2])$/)
		.nullish(),
})

export const goalPatchSchema = goalInputSchema.partial()

export const contributionInputSchema = z.object({
	amount: z
		.number()
		.min(-1_000_000_000)
		.max(1_000_000_000)
		.refine((value) => value !== 0),
	/** AAAA-MM-DD; padrão: hoje em São Paulo */
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()))
		.optional(),
	note: z.string().trim().max(120).nullish(),
})

/** "AAAA-MM" → primeiro dia do mês, à meia-noite UTC */
export function parseTargetMonth(value: string | null | undefined) {
	if (!value) return null
	const [year, month] = value.split('-').map(Number)
	return new Date(Date.UTC(year, month - 1, 1))
}

interface GoalRow {
	id: string
	name: string
	targetAmount: { toString(): string }
	targetMonth: Date | null
	contributions: { id: string; amount: { toString(): string }; date: Date; note: string | null }[]
}

/** Meta no formato da API: valores em reais e cálculos de progresso */
export function serializeGoal(goal: GoalRow, savedTotal: { toString(): string }, today: Date) {
	const target = toReais(toMoney(goal.targetAmount))
	const saved = toReais(toMoney(savedTotal))
	const { ratio, remaining } = goalProgress({ target, saved })
	return {
		id: goal.id,
		name: goal.name,
		targetAmount: target,
		targetMonth: goal.targetMonth ? monthKey(goal.targetMonth) : null,
		saved,
		ratio,
		remaining,
		monthlyNeeded: monthlyNeeded({ remaining, targetMonth: goal.targetMonth, today }),
		contributions: goal.contributions.map((item) => ({
			id: item.id,
			amount: toReais(toMoney(item.amount)),
			date: item.date.toISOString().slice(0, 10),
			note: item.note,
		})),
	}
}
