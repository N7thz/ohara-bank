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
