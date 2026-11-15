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

export interface BalancePoint {
	/** AAAA-MM-DD (UTC) */
	date: string
	/** Saldo no fim do dia */
	balance: number
}

/** Saldo no fim dos dias com movimento; vazio nas contas sem saldo */
export function useBalanceHistory(accountId: string | null) {
	return useQuery({
		// Fica sob ['finance', 'bank-accounts']: importar ou apagar extrato recarrega
		queryKey: ['finance', 'bank-accounts', accountId, 'balance-history'],
		queryFn: async () => {
			const { data } = await api.get<BalancePoint[]>(
				`/finance/accounts/${accountId}/balance-history`,
			)
			return data
		},
		enabled: accountId !== null,
	})
}
