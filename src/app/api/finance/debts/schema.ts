import { z } from 'zod'

export const debtInputSchema = z
	.object({
		name: z.string().trim().min(1).max(60),
		kind: z.enum(['FIXED', 'RECURRING', 'INSTALLMENT']),
		amount: z.number().positive().max(1_000_000_000),
		dueDay: z.number().int().min(1).max(31).nullable(),
		installments: z.number().int().min(1).max(480).nullable(),
		/** AAAA-MM */
		startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
		pattern: z.string().trim().min(3).max(120),
	})
	.refine((debt) => debt.kind !== 'INSTALLMENT' || debt.installments !== null, {
		path: ['installments'],
		message: 'Informe o número de parcelas',
	})

export type DebtInput = z.infer<typeof debtInputSchema>

/** Converte para o formato do banco: mês no dia 1 UTC, parcelas só na parcelada */
export function toDebtData(input: DebtInput) {
	const [year, month] = input.startMonth.split('-').map(Number)
	return {
		...input,
		startMonth: new Date(Date.UTC(year, month - 1, 1)),
		installments: input.kind === 'INSTALLMENT' ? input.installments : null,
	}
}
