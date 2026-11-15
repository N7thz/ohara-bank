'use client'

import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DebtKind } from './debts'
import { financeKeys } from './keys'

// /api/finance/recurring

export interface BillHistory {
	/** FIXED: mesmo valor todo mês; RECURRING: o valor muda (luz, fatura) */
	kind: 'FIXED' | 'RECURRING'
	count: number
	/** Meses com pagamento */
	months: number
	/** Média, mínimo e máximo do total de cada mês com pagamento */
	average: number
	min: number
	max: number
	/** (máximo − mínimo) ÷ média */
	variation: number
	/** Média dos últimos 3 meses com pagamento: o palpite para o próximo */
	estimate: number
	/** Último mês pago comparado à média dos anteriores (0,1 = 10% acima); null com um mês só */
	trend: number | null
	typicalDay: number
	lastPayment: { date: string; amount: number } | null
	/** Total pago no mês atual; 0 se ainda não pagou */
	paidThisMonth: number
	/** AAAA-MM-DD do próximo pagamento esperado */
	nextDue: string
	/** Sem pagamento há mais de 2 meses */
	active: boolean
	/** AAAA-MM do primeiro mês até o atual; null nos meses sem pagamento */
	monthly: { month: string; amount: number | null }[]
}

/** Conta cadastrada em Dívidas (fixa ou recorrente), com o histórico achado no extrato */
export interface TrackedBill extends BillHistory {
	debtId: string
	name: string
	kind: Exclude<DebtKind, 'INSTALLMENT'>
	/** Valor cadastrado na dívida */
	amount: number
}

/** Saída que se repete e ainda não é dívida */
export interface BillSuggestion extends BillHistory {
	key: string
	name: string
	isPerson: boolean
	/** Trecho para buscar na lista de transações */
	query: string
	/** Padrão para a dívida ("a|b") */
	pattern: string
}

export interface RecurringContact {
	key: string
	name: string
	query: string
	sent: number
	received: number
	sentCount: number
	receivedCount: number
	months: number
	firstDate: string
	lastDate: string
	/** Últimos 12 meses, do mais antigo para o atual */
	monthly: { month: string; sent: number; received: number }[]
}

export interface RecurringOverview {
	contacts: RecurringContact[]
	bills: TrackedBill[]
	suggestions: BillSuggestion[]
	/** Data da transação mais recente importada */
	importedUntil: string | null
}

export const recurringQuery = queryOptions({
	queryKey: financeKeys.recurring(),
	queryFn: async () => {
		const { data } = await api.get<RecurringOverview>('/finance/recurring')
		return data
	},
})

export function useRecurring() {
	return useQuery(recurringQuery)
}
