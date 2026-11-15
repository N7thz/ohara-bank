'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface LoginTotpStatus {
	/** pending = QR gerado mas código ainda não confirmado */
	status: 'connected' | 'pending' | 'locked' | 'not-configured'
	lockedUntil: string | null
}

export interface TotpStatus extends LoginTotpStatus {
	failedAttempts: number
	maxAttempts: number
	loginAllowed: boolean
}

export const securityKeys = {
	totpStatus: () => ['security', 'totp-status'] as const,
	loginTotpStatus: () => ['security', 'login-totp-status'] as const,
}

export function useTotpStatus() {
	return useQuery({
		queryKey: securityKeys.totpStatus(),
		queryFn: async () => {
			const { data } = await api.get<TotpStatus>('/security/totp')
			return data
		},
	})
}

export function useLoginTotpStatus() {
	return useQuery({
		queryKey: securityKeys.loginTotpStatus(),
		queryFn: async () => {
			const { data } = await api.get<LoginTotpStatus>('/security/totp/login-status')
			return data
		},
		// Bloqueado: confere de tempos em tempos para liberar o campo sozinho
		refetchInterval: (query) => (query.state.data?.status === 'locked' ? 30_000 : false),
	})
}
