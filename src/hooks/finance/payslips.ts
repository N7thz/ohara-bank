'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { financeKeys } from './keys'

// /api/finance/payslips

export interface PayslipItem {
	id: string
	code: string
	description: string
	reference: string | null
	kind: 'EARNING' | 'DEDUCTION'
	amount: number
}

export interface Payslip {
	id: string
	employerName: string
	employerCnpj: string
	/** Primeiro dia do mês de competência (UTC) */
	competence: string
	grossAmount: number
	deductionsAmount: number
	netAmount: number
	fgtsAmount: number | null
	items: PayslipItem[]
}

export function usePayslips() {
	return useQuery({
		queryKey: financeKeys.payslips(),
		queryFn: async () => {
			const { data } = await api.get<Payslip[]>('/finance/payslips')
			return data
		},
	})
}

export function useDeletePayslip() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (id: string) => {
			await api.delete(`/finance/payslips/${id}`)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: financeKeys.payslips() })
		},
	})
}
