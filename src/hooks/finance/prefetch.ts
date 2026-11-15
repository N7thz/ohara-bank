'use client'

import { useQueryClient } from '@tanstack/react-query'
import { debtsQuery } from './debts'
import { recurringQuery } from './recurring'
import { DEFAULT_SUMMARY_FILTERS, summaryQuery } from './summary'
import { DEFAULT_TRANSACTION_FILTERS, transactionsQuery } from './transactions'

/** Busca os dados da página antes do clique no menu; a navegação abre com tudo em cache */
export function usePrefetchFinancePage() {
	const queryClient = useQueryClient()

	return (href: string) => {
		if (href === '/dashboard') {
			queryClient.prefetchQuery(summaryQuery(DEFAULT_SUMMARY_FILTERS))
		}
		if (href === '/dashboard/finance/transactions') {
			queryClient.prefetchQuery(transactionsQuery(DEFAULT_TRANSACTION_FILTERS))
		}
		if (href === '/dashboard/finance/debts') {
			queryClient.prefetchQuery(debtsQuery)
		}
		if (href === '/dashboard/finance/recurring') {
			queryClient.prefetchQuery(recurringQuery)
		}
	}
}
