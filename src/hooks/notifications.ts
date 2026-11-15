'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// /api/notifications

export interface EmailSettings {
	billReminders: boolean
	/** Avisa de contas que vencem em até tantos dias */
	billReminderDays: number
	weeklySummary: boolean
	monthlySummary: boolean
	budgetAlerts: boolean
}

export type EmailKind = 'bills' | 'weekly' | 'monthly' | 'budget' | 'test'

export interface EmailLog {
	id: string
	kind: EmailKind
	subject: string
	/** null = enviado */
	error: string | null
	sentAt: string
}

export interface NotificationsData {
	settings: EmailSettings
	/** SMTP_USER e SMTP_PASS no .env */
	configured: boolean
	recipient: string
	logs: EmailLog[]
}

export const notificationKeys = {
	all: ['notifications'] as const,
}

export function useNotifications() {
	return useQuery({
		queryKey: notificationKeys.all,
		queryFn: async () => {
			const { data } = await api.get<NotificationsData>('/notifications')
			return data
		},
	})
}

function useInvalidateNotifications() {
	const queryClient = useQueryClient()
	return () => queryClient.invalidateQueries({ queryKey: notificationKeys.all })
}

export function useSaveEmailSettings() {
	const invalidate = useInvalidateNotifications()

	return useMutation({
		mutationFn: async (settings: EmailSettings) => {
			await api.put('/notifications', settings)
		},
		onSuccess: invalidate,
	})
}

export function useSendTestEmail() {
	const invalidate = useInvalidateNotifications()

	return useMutation({
		mutationFn: async () => {
			const { data } = await api.post<{ subject: string; to: string }>('/notifications/test')
			return data
		},
		// Falha também entra no registro
		onSettled: invalidate,
	})
}

export function useRunEmailJobs() {
	const invalidate = useInvalidateNotifications()

	return useMutation({
		mutationFn: async () => {
			const { data } = await api.post<{
				results: { kind: EmailKind; subject: string; error: string | null }[]
			}>('/notifications/run')
			return data.results
		},
		onSettled: invalidate,
	})
}

// /api/notifications/inbox: avisos dentro do app (o sino no topo)

export interface InboxNotification {
	id: string
	kind: Exclude<EmailKind, 'test'>
	title: string
	body: string | null
	/** Página aberta ao clicar */
	href: string | null
	/** null = não lido */
	readAt: string | null
	createdAt: string
}

export interface InboxData {
	items: InboxNotification[]
	unread: number
}

export const inboxKeys = {
	all: ['notifications', 'inbox'] as const,
}

/** Confere avisos novos a cada minuto, também com a aba em segundo plano */
export function useInbox() {
	return useQuery({
		queryKey: inboxKeys.all,
		queryFn: async () => {
			const { data } = await api.get<InboxData>('/notifications/inbox')
			return data
		},
		refetchInterval: 60 * 1000,
	})
}

/** Sem ids: marca todos como lidos */
export function useMarkNotificationsRead() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (ids?: string[]) => {
			await api.patch('/notifications/inbox', { ids })
		},
		onMutate: async (ids) => {
			// Some do contador na hora; o servidor confirma logo depois
			await queryClient.cancelQueries({ queryKey: inboxKeys.all })
			const previous = queryClient.getQueryData<InboxData>(inboxKeys.all)
			if (previous) {
				const now = new Date().toISOString()
				const items = previous.items.map((item) =>
					!item.readAt && (!ids || ids.includes(item.id)) ? { ...item, readAt: now } : item,
				)
				queryClient.setQueryData<InboxData>(inboxKeys.all, {
					items,
					unread: ids ? Math.max(0, previous.unread - ids.length) : 0,
				})
			}
			return { previous }
		},
		onError: (_error, _ids, context) => {
			if (context?.previous) queryClient.setQueryData(inboxKeys.all, context.previous)
		},
		onSettled: () => queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
	})
}
