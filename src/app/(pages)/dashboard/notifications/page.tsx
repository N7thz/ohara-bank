import type { Metadata } from 'next'
import { NotificationsView } from './_components/notifications-view'

export const metadata: Metadata = {
	title: 'Notificações',
	description: 'E-mails automáticos com contas a vencer, resumos e alertas de orçamento.',
}

export default function NotificationsPage() {
	return <NotificationsView />
}
