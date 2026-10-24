import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TransactionsView } from './_components/transactions-view'

export const metadata: Metadata = {
	title: 'Transações',
	description: 'Transações importadas, com filtros e tags.',
}

export default function TransactionsPage() {
	// Os filtros vêm da URL (useSearchParams), que só existe no navegador
	return (
		<Suspense>
			<TransactionsView />
		</Suspense>
	)
}
