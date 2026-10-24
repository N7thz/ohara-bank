'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { financeKeys, useInvalidateFinance } from './keys'

// /api/finance/accounts

export interface BankAccount {
	id: string
	bankName: string
	number: string
	type: 'CHECKING' | 'CREDIT_CARD'
	balance: number | null
	balanceDate: string | null
	transactionCount: number
}

export interface StatementTransaction {
	id: string
	date: string
	/** Negativo = saída, positivo = entrada */
	amount: number
	description: string
}

export function useBankAccounts() {
	return useQuery({
		queryKey: financeKeys.accounts(),
		queryFn: async () => {
			const { data } = await api.get<BankAccount[]>('/finance/accounts')
			return data
		},
	})
}

export function useDeleteBankAccount() {
	const invalidate = useInvalidateFinance()

	return useMutation({
		mutationFn: async (id: string) => {
			await api.delete(`/finance/accounts/${id}`)
		},
		onSuccess: invalidate,
	})
}
