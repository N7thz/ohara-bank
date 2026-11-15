import type { Metadata } from 'next'
import { RecurringView } from './_components/recurring-view'

export const metadata: Metadata = {
	title: 'Recorrentes',
	description: 'Contas de valor variável e contatos recorrentes, a partir dos extratos.',
}

export default function RecurringPage() {
	return <RecurringView />
}
