'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BankAccount } from './accounts'
import { financeKeys } from './keys'

// /api/finance/import

export type ImportResult =
	| {
			kind: 'statement'
			accountId: string
			bankName: string
			imported: number
			duplicates: number
	  }
	| {
			kind: 'payslip'
			payslipId: string
			employerName: string
			competence: string
			/** false = competência já tinha sido importada */
			created: boolean
	  }

export interface ImportInput {
	file: File
	/** Só para CSV genérico, que não diz de qual banco é */
	bankName?: string
	type?: BankAccount['type']
}

export function useImportStatement() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ file, bankName, type }: ImportInput) => {
			const formData = new FormData()
			formData.append('file', file)
			if (bankName) formData.append('bankName', bankName)
			if (type) formData.append('type', type)
			const { data } = await api.post<ImportResult>('/finance/import', formData)
			return data
		},
		onSuccess: (result) => {
			queryClient.invalidateQueries({
				queryKey: result.kind === 'payslip' ? financeKeys.payslips() : financeKeys.all,
			})
		},
	})
}
