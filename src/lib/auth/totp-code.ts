import { z } from 'zod'

export const totpCodeSchema = z.object({
	code: z.string().length(6, 'O código deve ter 6 dígitos').regex(/^\d+$/, 'Apenas números'),
})

export type TotpCodeData = z.infer<typeof totpCodeSchema>

/** Mantém só os 6 primeiros dígitos (aceita "123 456" colado do autenticador) */
export function formatTotpCode(value: string) {
	return value.replace(/\D/g, '').slice(0, 6)
}
