'use client'

import { useQueryClient } from '@tanstack/react-query'

/** Tudo de finanças fica sob ['finance']: invalidar a raiz recarrega todas as telas */
export const financeKeys = {
	all: ['finance'] as const,
	accounts: () => ['finance', 'bank-accounts'] as const,
	payslips: () => ['finance', 'payslips'] as const,
	tags: () => ['finance', 'tags'] as const,
	transactions: (filters: object) => ['finance', 'transactions', filters] as const,
	summary: (filters: object) => ['finance', 'summary', filters] as const,
	debts: () => ['finance', 'debts'] as const,
}

// Contas, tags e dívidas mexem na lista de transações e nos totais, então tudo de finanças recarrega
export function useInvalidateFinance() {
	const queryClient = useQueryClient()
	return () => queryClient.invalidateQueries({ queryKey: financeKeys.all })
}
