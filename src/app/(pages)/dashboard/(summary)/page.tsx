import type { Metadata } from 'next'
import { SummaryView } from './_components/summary-view'

export const metadata: Metadata = {
	title: 'Resumo',
	description: 'Entradas, saídas e gastos por tag, por semana ou por mês.',
}

export default function DashboardPage() {
	return <SummaryView />
}
