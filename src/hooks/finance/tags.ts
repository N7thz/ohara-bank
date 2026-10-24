'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { financeKeys, useInvalidateFinance } from './keys'

// /api/finance/tags e /api/finance/tags/[id]/rules

export type TagColor = 'blue' | 'orange' | 'aqua' | 'yellow' | 'magenta' | 'violet'

export interface Tag {
	id: string
	name: string
	color: TagColor
	/** Transferência entre contas e afins: aparece na lista, mas não conta nos totais */
	excludeFromTotals: boolean
	rules: { id: string; pattern: string }[]
	transactionCount: number
}

export function useTags() {
	return useQuery({
		queryKey: financeKeys.tags(),
		queryFn: async () => {
			const { data } = await api.get<Tag[]>('/finance/tags')
			return data
		},
	})
}

export function useCreateTag() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async (input: { name: string; color?: TagColor }) => {
			const { data } = await api.post<Tag>('/finance/tags', input)
			return data
		},
		onSuccess: invalidate,
	})
}

export function useUpdateTag() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async ({
			id,
			...input
		}: {
			id: string
			name?: string
			color?: TagColor
			excludeFromTotals?: boolean
		}) => {
			await api.patch(`/finance/tags/${id}`, input)
		},
		onSuccess: invalidate,
	})
}

export function useDeleteTag() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async (id: string) => {
			await api.delete(`/finance/tags/${id}`)
		},
		onSuccess: invalidate,
	})
}

export function useCreateTagRule() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async ({ tagId, pattern }: { tagId: string; pattern: string }) => {
			const { data } = await api.post<{ id: string; pattern: string; applied: number }>(
				`/finance/tags/${tagId}/rules`,
				{ pattern },
			)
			return data
		},
		onSuccess: invalidate,
	})
}

export function useDeleteTagRule() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async ({ tagId, ruleId }: { tagId: string; ruleId: string }) => {
			await api.delete(`/finance/tags/${tagId}/rules/${ruleId}`)
		},
		onSuccess: invalidate,
	})
}
