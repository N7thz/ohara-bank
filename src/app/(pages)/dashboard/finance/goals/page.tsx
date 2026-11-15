import type { Metadata } from 'next'
import { GoalsView } from './_components/goals-view'

export const metadata: Metadata = {
	title: 'Metas e economias',
	description: 'Metas de economia e quanto sobra por mês.',
}

export default function GoalsPage() {
	return <GoalsView />
}
