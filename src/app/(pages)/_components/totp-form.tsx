'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { TotpStatusBadge } from '@/components/security/totp-status-badge'
import { Button } from '@/components/ui/button'
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { type LoginTotpStatus, useLoginTotpStatus } from '@/hooks/security/totp'
import { authClient } from '@/lib/auth/client'
import { formatTotpCode, type TotpCodeData, totpCodeSchema } from '@/lib/auth/totp-code'

function statusMessage(totp: LoginTotpStatus) {
	switch (totp.status) {
		case 'locked':
			return `Muitos códigos errados seguidos. Tente de novo ${
				totp.lockedUntil ? `às ${format(totp.lockedUntil, 'HH:mm')}` : 'em alguns minutos'
			}.`
		case 'pending':
			return 'O autenticador não foi confirmado. Conclua a configuração na tela de Segurança.'
		case 'not-configured':
			return 'Nenhum autenticador configurado. Entre com a passkey.'
		case 'connected':
			return null
	}
}

interface TotpFormProps {
	onSuccess: () => void
	onUsePasskey: () => void
}

export function TotpForm({ onSuccess, onUsePasskey }: TotpFormProps) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<TotpCodeData>({
		resolver: zodResolver(totpCodeSchema),
		defaultValues: { code: '' },
	})

	const codeField = register('code')

	const { data: totp, refetch: refetchStatus } = useLoginTotpStatus()
	const isAvailable = !totp || totp.status === 'connected'
	const message = totp && statusMessage(totp)

	async function onSubmit({ code }: TotpCodeData) {
		const { error } = await authClient.$fetch('/totp-sign-in', {
			method: 'POST',
			body: { code },
		})

		if (error) {
			toast.error(
				error.status === 429
					? (error.message ?? 'Muitas tentativas')
					: 'Código inválido ou expirado',
			)
			reset()
			refetchStatus()
			return
		}

		onSuccess()
	}

	return (
		<>
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<CardTitle>Código do autenticador</CardTitle>
					{totp && <TotpStatusBadge status={totp.status} />}
				</div>
				<CardDescription>
					Digite o código de 6 dígitos do seu aplicativo autenticador
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<label htmlFor="totp-code" className="text-sm font-medium">
							Código
						</label>
						<Input
							id="totp-code"
							type="text"
							inputMode="numeric"
							autoComplete="one-time-code"
							placeholder="000000"
							aria-invalid={!!errors.code}
							disabled={!isAvailable}
							{...codeField}
							onChange={(event) => {
								event.target.value = formatTotpCode(event.target.value)
								codeField.onChange(event)
							}}
						/>
						{errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
					</div>

					{message && (
						<p
							className={isAvailable ? 'text-xs text-muted-foreground' : 'text-sm text-destructive'}
						>
							{message}
						</p>
					)}

					<Button type="submit" disabled={isSubmitting || !isAvailable} className="w-full">
						{isSubmitting ? 'Verificando...' : 'Entrar'}
					</Button>

					<Button type="button" variant="link" className="w-full" onClick={onUsePasskey}>
						Entrar com passkey
					</Button>
				</form>
			</CardContent>
		</>
	)
}
