'use client'

import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { financeKeys, useInvalidateFinance } from './keys'

// /api/finance/goals

export interface GoalContribution {
	id: string
	/** Positivo = guardado; negativo = retirado */
	amount: number
	/** AAAA-MM-DD */
	date: string
	note: string | null
}

export interface Goal {
	id: string
	name: string
	targetAmount: number
	/** AAAA-MM; null = sem prazo */
	targetMonth: string | null
	/** Soma de todos os valores guardados e retirados */
	saved: number
	/** Progresso de 0 a 1 */
	ratio: number
	/** Quanto falta (nunca negativo) */
	remaining: number
	/** Valor por mês até o mês-alvo; null sem prazo */
	monthlyNeeded: number | null
	/** Últimos 10 */
	contributions: GoalContribution[]
}

export interface GoalInput {
	name: string
	targetAmount: number
	/** AAAA-MM; null remove o prazo */
	targetMonth: string | null
}

export interface ContributionInput {
	/** Positivo guarda; negativo retira */
	amount: number
	/** AAAA-MM-DD; sem data, hoje */
	date?: string
	note?: string | null
}

export const goalsQuery = queryOptions({
	queryKey: financeKeys.goals(),
	queryFn: async () => {
		const { data } = await api.get<{ goals: Goal[] }>('/finance/goals')
		return data.goals
	},
})

export function useGoals() {
	return useQuery(goalsQuery)
}

export function useCreateGoal() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async (input: GoalInput) => {
			await api.post('/finance/goals', input)
		},
		onSuccess: invalidate,
	})
}

export function useUpdateGoal() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async ({ id, ...input }: GoalInput & { id: string }) => {
			await api.patch(`/finance/goals/${id}`, input)
		},
		onSuccess: invalidate,
	})
}

export function useDeleteGoal() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async (id: string) => {
			await api.delete(`/finance/goals/${id}`)
		},
		onSuccess: invalidate,
	})
}

export function useAddContribution() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async ({ goalId, ...input }: ContributionInput & { goalId: string }) => {
			await api.post(`/finance/goals/${goalId}/contributions`, input)
		},
		onSuccess: invalidate,
	})
}

export function useDeleteContribution() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async ({ goalId, id }: { goalId: string; id: string }) => {
			await api.delete(`/finance/goals/${goalId}/contributions/${id}`)
		},
		onSuccess: invalidate,
	})
}
