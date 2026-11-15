'use client'

import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { financeKeys } from './keys'

// /api/finance/summary

export type SummaryGranularity = 'week' | 'month'

export interface SummaryPeriod {
	/** Primeiro e último dia do período (AAAA-MM-DD, UTC) */
	start: string
	end: string
	income: number
	/** Negativo */
	expense: number
	count: number
	/** Saídas por tag (negativo); uma transação com duas tags conta nas duas */
	byTag: Record<string, number>
	/** Saídas sem tag (negativo) */
	untagged: number
	/** Entradas e saídas fora dos totais (transferências entre contas e afins) */
	excludedIn: number
	excludedOut: number
}

export interface SummaryFilters {
	granularity: SummaryGranularity
	accountId?: string
}

/** Primeira visão, para pré-carregar ao passar o mouse no menu */
export const DEFAULT_SUMMARY_FILTERS: SummaryFilters = { granularity: 'month' }

export function summaryQuery(filters: SummaryFilters) {
	return queryOptions({
		queryKey: financeKeys.summary(filters),
		queryFn: async () => {
			const { data } = await api.get<{ granularity: SummaryGranularity; periods: SummaryPeriod[] }>(
				'/finance/summary',
				{ params: filters },
			)
			return data
		},
	})
}

export function useFinanceSummary(filters: SummaryFilters) {
	return useQuery({ ...summaryQuery(filters), placeholderData: keepPreviousData })
}

// /api/finance/summary/merchants

export interface MerchantFilters {
	/** Período escolhido, AAAA-MM-DD inclusive */
	start: string
	end: string
	/** Começo do período anterior, para comparar */
	previousStart?: string
	accountId?: string
}

export interface Merchant {
	name: string
	/** Trecho da descrição para buscar na lista de transações */
	query: string
	/** Positivo */
	total: number
	count: number
	/** Gasto no período anterior; null sem período anterior */
	previous: number | null
	/** Tag mais usada nas compras do lugar */
	tagId: string | null
}

export interface MerchantRanking {
	/** Todas as saídas do período, sem as transferências entre contas */
	total: number
	merchants: Merchant[]
	/** Lugares fora da lista */
	others: { count: number; total: number }
}

export function useTopMerchants(filters: MerchantFilters | undefined) {
	return useQuery({
		queryKey: financeKeys.merchants(filters ?? {}),
		queryFn: async () => {
			const { data } = await api.get<MerchantRanking>('/finance/summary/merchants', {
				params: filters,
			})
			return data
		},
		enabled: !!filters,
		placeholderData: keepPreviousData,
	})
}

// /api/finance/summary/daily

export interface DailySpendingFilters {
	/** Período escolhido, AAAA-MM-DD inclusive */
	start: string
	end: string
	/** Começo do período anterior, para comparar */
	previousStart?: string
	accountId?: string
}

export interface DailySpending {
	/** Saída por dia (positivo); só os dias com gasto */
	current: { date: string; total: number }[]
	/** null sem período anterior */
	previous: { date: string; total: number }[] | null
	/** Último dia com transação na conta; depois dele não há extrato */
	lastStatementDate: string | null
}

export function useDailySpending(filters: DailySpendingFilters | undefined) {
	return useQuery({
		// Começa por ['finance', 'summary'] para a invalidação de financeKeys.all alcançar
		queryKey: ['finance', 'summary', 'daily', filters ?? {}] as const,
		queryFn: async () => {
			const { data } = await api.get<DailySpending>('/finance/summary/daily', {
				params: filters,
			})
			return data
		},
		enabled: !!filters,
		placeholderData: keepPreviousData,
	})
}
