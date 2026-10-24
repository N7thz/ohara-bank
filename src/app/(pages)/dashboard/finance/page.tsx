import type { Metadata } from 'next'
import { FinanceView } from './_components/finance-view'

export const metadata: Metadata = {
	title: 'Finanças',
	description: 'Contas, extratos importados e holerites.',
}

export default function FinancePage() {
	return <FinanceView />
}
