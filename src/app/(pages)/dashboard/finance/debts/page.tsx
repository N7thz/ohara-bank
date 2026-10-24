import type { Metadata } from 'next'
import { DebtsView } from './_components/debts-view'

export const metadata: Metadata = {
	title: 'Dívidas',
	description: 'Contas fixas, recorrentes e parceladas.',
}

export default function DebtsPage() {
	return <DebtsView />
}
