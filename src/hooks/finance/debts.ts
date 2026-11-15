'use client'

import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { financeKeys, useInvalidateFinance } from './keys'

// /api/finance/debts

export type DebtKind = 'FIXED' | 'RECURRING' | 'INSTALLMENT'

/** Situação da dívida no mês atual */
export type DebtMonthStatus =
	| 'paid'
	| 'partial'
	| 'pending'
	| 'late'
	| 'skipped'
	| 'not-started'
	| 'finished'

/** Situação do mês marcada à mão */
export type DebtOverrideStatus = 'PAID' | 'PENDING' | 'SKIPPED'

export interface Debt {
	id: string
	name: string
	kind: DebtKind
	/** Valor por mês; na parcelada, o valor de cada parcela */
	amount: number
	dueDay: number | null
	installments: number | null
	/** Parcelas pagas que não aparecem nas transações */
	paidBefore: number
	/** Primeiro dia do mês (AAAA-MM-DD, UTC) */
	startMonth: string
	/** Mês da última parcela; null nas fixas e recorrentes */
	endMonth: string | null
	pattern: string
	/** Soma dos pagamentos achados nas transações desde o início (positivo) */
	paidTotal: number
	paidInstallments: number | null
	remainingAmount: number | null
	paidThisMonth: number
	status: DebtMonthStatus
	/** Situação calculada pelas transações, antes da marcada à mão */
	autoStatus: DebtMonthStatus
	/** Marcada à mão no mês atual; null = automática */
	statusOverride: DebtOverrideStatus | null
	lastPayment: { date: string; amount: number; description: string } | null
	paymentCount: number
	/** Meses com pagamento desde o início: viram as parcelas pagas ao parcelar */
	paidMonths: number
}

export interface DebtMonth {
	start: string
	end: string
	/** Soma das dívidas ativas no mês */
	expected: number
	/** Pagamentos achados; null nos meses futuros */
	paid: number | null
}

export interface DebtSuggestion {
	name: string
	pattern: string
	kind: DebtKind
	amount: number
	dueDay: number
	months: number
	count: number
	/** AAAA-MM do primeiro pagamento visto */
	firstMonth: string
}

export interface DebtsOverview {
	debts: Debt[]
	months: DebtMonth[]
	suggestions: DebtSuggestion[]
	/** Data da transação mais recente importada */
	importedUntil: string | null
}

export interface DebtInput {
	name: string
	kind: DebtKind
	amount: number
	dueDay: number | null
	installments: number | null
	/** Parcelas pagas que não aparecem nas transações */
	paidBefore: number
	/** AAAA-MM */
	startMonth: string
	pattern: string
}

export const debtsQuery = queryOptions({
	queryKey: financeKeys.debts(),
	queryFn: async () => {
		const { data } = await api.get<DebtsOverview>('/finance/debts')
		return data
	},
})

export function useDebts() {
	return useQuery(debtsQuery)
}

export function useSaveDebt() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async ({ id, ...input }: DebtInput & { id?: string }) => {
			if (id) await api.put(`/finance/debts/${id}`, input)
			else await api.post('/finance/debts', input)
		},
		onSuccess: invalidate,
	})
}

export function useDeleteDebt() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async (id: string) => {
			await api.delete(`/finance/debts/${id}`)
		},
		onSuccess: invalidate,
	})
}

export function useSetDebtStatus() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async ({ id, status }: { id: string; status: DebtOverrideStatus | null }) => {
			await api.put(`/finance/debts/${id}/status`, { status })
		},
		onSuccess: invalidate,
	})
}

export interface DebtPatternPreview {
	/** Saídas que casam com o trecho */
	count: number
	/** As 3 mais recentes; amount positivo */
	recent: { id: string; date: string; amount: number; description: string }[]
}

/** Quais saídas casam com o trecho; só consulta com 3 caracteres ou mais */
export function useDebtPatternPreview(pattern: string, startMonth: string) {
	return useQuery({
		queryKey: [...financeKeys.debts(), 'preview', pattern, startMonth],
		queryFn: async () => {
			const { data } = await api.get<DebtPatternPreview>('/finance/debts/preview', {
				params: { pattern, startMonth },
			})
			return data
		},
		enabled: pattern.length >= 3,
		placeholderData: (previous) => previous,
	})
}
