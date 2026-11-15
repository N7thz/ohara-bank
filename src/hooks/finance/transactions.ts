'use client'

import { keepPreviousData, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BankAccount, StatementTransaction } from './accounts'
import { financeKeys, useInvalidateFinance } from './keys'
import type { SummaryPeriod } from './summary'

// /api/finance/transactions e /api/finance/transactions/[id]/tags

export interface TransactionFilters {
	accountId?: string
	/** AAAA-MM */
	month?: string
	type?: 'income' | 'expense'
	q?: string
	/** Id da tag, ou "none" para transações sem tag */
	tagId?: string
	page: number
	/** 1 a 100; padrão 50 */
	pageSize?: number
}

export interface TransactionWithAccount extends StatementTransaction {
	account: Pick<BankAccount, 'bankName' | 'number' | 'type'>
	tagIds: string[]
	/** Parcela da dívida parcelada que esta transação paga */
	installment: { debtId: string; debtName: string; number: number; total: number } | null
}

export interface TransactionPage {
	transactions: TransactionWithAccount[]
	total: number
	page: number
	pageSize: number
	/** Entradas (positivo) e saídas (negativo) com os filtros, sem contar o tipo nem as transações fora dos totais */
	summary: { income: number; expense: number; excludedCount: number }
}

/** O que não depende da página: /api/finance/transactions/overview */
export interface TransactionsOverview {
	/** Meses com transações, do mais recente ao mais antigo (AAAA-MM) */
	months: string[]
	/** Totais por tag no período (sem o filtro de tag); uma transação conta em cada tag que tiver */
	byTag: { tagId: string; income: number; expense: number; expenseCount: number }[]
	/** Saídas sem nenhuma tag */
	untagged: { expense: number; count: number }
	/** Entradas e saídas por mês com os filtros, menos o de mês e o tipo, sem as transações fora dos totais */
	byMonth: Pick<SummaryPeriod, 'start' | 'end' | 'income' | 'expense'>[]
	/** Quantas transações cada tag tem com conta, período e busca (inclui as fora dos totais) */
	tagCounts: Record<string, number>
}

/** Primeira página, para pré-carregar ao passar o mouse no menu */
export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = { page: 1 }

export function transactionsQuery(filters: TransactionFilters) {
	return queryOptions({
		queryKey: financeKeys.transactions(filters),
		queryFn: async () => {
			const { data } = await api.get<TransactionPage>('/finance/transactions', { params: filters })
			return data
		},
	})
}

export type TransactionsOverviewFilters = Omit<TransactionFilters, 'page' | 'pageSize'>

export function transactionsOverviewQuery(filters: TransactionsOverviewFilters) {
	return queryOptions({
		// Sem a página: trocar de página não refaz o resumo
		queryKey: financeKeys.transactionsOverview(filters),
		queryFn: async () => {
			const { data } = await api.get<TransactionsOverview>('/finance/transactions/overview', {
				params: filters,
			})
			return data
		},
	})
}

export function useTransactionsOverview(filters: TransactionsOverviewFilters) {
	return useQuery({ ...transactionsOverviewQuery(filters), placeholderData: keepPreviousData })
}

export function useTransactions(filters: TransactionFilters) {
	// Mantém a página atual na tela enquanto a próxima carrega
	return useQuery({ ...transactionsQuery(filters), placeholderData: keepPreviousData })
}

export interface DailySpending {
	/** AAAA-MM-DD */
	date: string
	/** Saídas do dia que contam nos totais, em reais positivos */
	total: number
	count: number
}

/** Os mesmos filtros da lista, menos tipo e página (aqui são sempre as saídas) */
export type DailySpendingFilters = Pick<TransactionFilters, 'accountId' | 'month' | 'q' | 'tagId'>

/** /api/finance/transactions/daily */
export function dailySpendingQuery(filters: DailySpendingFilters) {
	return queryOptions({
		// Sob 'finance': a invalidação de financeKeys.all também atinge esta consulta
		queryKey: ['finance', 'transactions', 'daily', filters] as const,
		queryFn: async () => {
			const { data } = await api.get<DailySpending[]>('/finance/transactions/daily', {
				params: filters,
			})
			return data
		},
	})
}

export function useDailySpending(filters: DailySpendingFilters) {
	return useQuery({ ...dailySpendingQuery(filters), placeholderData: keepPreviousData })
}

export function useSetTransactionTags() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async ({ transactionId, tagIds }: { transactionId: string; tagIds: string[] }) => {
			await api.put(`/finance/transactions/${transactionId}/tags`, { tagIds })
		},
		onSuccess: invalidate,
	})
}
