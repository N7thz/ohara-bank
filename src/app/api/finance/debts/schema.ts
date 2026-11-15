import { z } from 'zod'

export const debtInputSchema = z
	.object({
		name: z.string().trim().min(1).max(60),
		kind: z.enum(['FIXED', 'RECURRING', 'INSTALLMENT']),
		amount: z.number().positive().max(1_000_000_000),
		dueDay: z.number().int().min(1).max(31).nullable(),
		installments: z.number().int().min(1).max(480).nullable(),
		/** Parcelas pagas que não aparecem nas transações */
		paidBefore: z.number().int().min(0).max(480).default(0),
		/** AAAA-MM */
		startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
		pattern: z
			.string()
			.trim()
			.min(3)
			.max(120)
			.refine((value) => value.split('|').every((part) => part.trim().length >= 3), {
				message: 'Cada trecho separado por | precisa de pelo menos 3 letras',
			}),
	})
	.refine((debt) => debt.kind !== 'INSTALLMENT' || debt.installments !== null, {
		path: ['installments'],
		message: 'Informe o número de parcelas',
	})
	.refine((debt) => debt.installments === null || debt.paidBefore <= debt.installments, {
		path: ['paidBefore'],
		message: 'Mais parcelas pagas que o total',
	})

export type DebtInput = z.infer<typeof debtInputSchema>

/** Converte para o formato do banco: mês no dia 1 UTC, parcelas só na parcelada */
export function toDebtData(input: DebtInput) {
	const [year, month] = input.startMonth.split('-').map(Number)
	return {
		...input,
		startMonth: new Date(Date.UTC(year, month - 1, 1)),
		installments: input.kind === 'INSTALLMENT' ? input.installments : null,
		paidBefore: input.kind === 'INSTALLMENT' ? input.paidBefore : 0,
	}
}
