'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'

import { TotpStatusBadge } from '@/components/security/totp-status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { securityKeys, type TotpStatus, useTotpStatus } from '@/hooks/security/totp'
import { authClient } from '@/lib/auth/client'
import { formatTotpCode, type TotpCodeData, totpCodeSchema } from '@/lib/auth/totp-code'

const STATUS_DESCRIPTION: Record<TotpStatus['status'], string> = {
	connected: 'Use na tela de login quando não tiver a passkey à mão.',
	locked:
		'Muitos códigos errados seguidos. O login com código volta a funcionar depois do horário abaixo.',
	pending:
		'O QR code foi gerado, mas o código nunca foi confirmado. O login com código não funciona até concluir.',
	'not-configured': 'Configure para ter uma forma de entrar sem a passkey.',
}

function secretFromUri(totpURI: string) {
	return new URL(totpURI).searchParams.get('secret') ?? ''
}

/** Autenticador (TOTP): login de reserva quando a passkey não estiver à mão */
export function TwoFactorSetup() {
	const [totpURI, setTotpURI] = useState<string | null>(null)
	const [isStarting, setIsStarting] = useState(false)

	const queryClient = useQueryClient()
	const { data: session, isPending, refetch } = authClient.useSession()
	const { data: totp, isPending: isTotpPending } = useTotpStatus()

	function refreshStatus() {
		refetch()
		queryClient.invalidateQueries({ queryKey: securityKeys.totpStatus() })
	}

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

	const isConfigured = !!session?.user.twoFactorEnabled

	async function startSetup() {
		if (
			isConfigured &&
			!confirm(
				'O autenticador atual para de funcionar assim que você começar. Se não concluir, o login de reserva fica desativado. Continuar?',
			)
		) {
			return
		}

		setIsStarting(true)

		// Trocar = desativar o atual e gerar um segredo novo
		if (isConfigured) {
			const { error } = await authClient.twoFactor.disable({})
			if (error) {
				setIsStarting(false)
				toast.error('Erro ao trocar o autenticador')
				refreshStatus()
				return
			}
		}

		const { data, error } = await authClient.twoFactor.enable({})
		setIsStarting(false)

		if (error || data.method !== 'totp') {
			toast.error('Erro ao gerar o QR code')
			refreshStatus()
			return
		}

		setTotpURI(data.totpURI)
		refreshStatus()
	}

	// Só passa a valer depois que o primeiro código é confirmado
	async function confirmSetup({ code }: TotpCodeData) {
		const { error } = await authClient.twoFactor.verifyTotp({ code })

		if (error) {
			toast.error('Código inválido. Confira o horário do celular e tente de novo.')
			return
		}

		toast.success('Autenticador configurado')
		setTotpURI(null)
		reset()
		refreshStatus()
	}

	if (isPending || isTotpPending) {
		return <Skeleton className="h-40 w-full" />
	}

	if (totpURI) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Escaneie o QR code</CardTitle>
					<CardDescription>
						Use o Google Authenticator, Authy ou similar e digite o código gerado para concluir.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-6">
					<div className="flex justify-center rounded-lg bg-white p-4">
						<QRCode value={totpURI} size={180} />
					</div>

					<div className="flex flex-col gap-1">
						<p className="text-xs text-muted-foreground">Ou digite a chave manualmente:</p>
						<code className="break-all rounded bg-muted px-2 py-1 font-mono text-xs">
							{secretFromUri(totpURI)}
						</code>
					</div>

					<form onSubmit={handleSubmit(confirmSetup)} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<label htmlFor="2fa-code" className="text-sm font-medium">
								Código do autenticador
							</label>
							<Input
								id="2fa-code"
								type="text"
								inputMode="numeric"
								autoComplete="one-time-code"
								placeholder="000000"
								aria-invalid={!!errors.code}
								{...codeField}
								onChange={(event) => {
									event.target.value = formatTotpCode(event.target.value)
									codeField.onChange(event)
								}}
							/>
							{errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
						</div>

						<Button type="submit" disabled={isSubmitting} className="w-full">
							{isSubmitting ? 'Verificando...' : 'Confirmar'}
						</Button>
					</form>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<CardTitle>Código do autenticador</CardTitle>
					{totp && <TotpStatusBadge status={totp.status} />}
				</div>
				<CardDescription>
					{totp ? STATUS_DESCRIPTION[totp.status] : 'Não foi possível carregar o status.'}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{totp && totp.status !== 'not-configured' && (
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
						<dt className="text-muted-foreground">Códigos errados seguidos</dt>
						<dd className="text-right">
							{totp.failedAttempts} de {totp.maxAttempts}
						</dd>
						{totp.lockedUntil && (
							<>
								<dt className="text-muted-foreground">Bloqueado até</dt>
								<dd className="text-right">{format(totp.lockedUntil, "dd/MM 'às' HH:mm")}</dd>
							</>
						)}
					</dl>
				)}

				{totp && !totp.loginAllowed && (
					<p className="text-xs text-destructive">
						Seu e-mail não é o ADMIN_EMAIL do servidor, então o login com código não vale para esta
						conta.
					</p>
				)}

				<Button
					onClick={startSetup}
					disabled={isStarting}
					variant={isConfigured ? 'outline' : 'default'}
					className="w-full"
				>
					{isStarting ? 'Gerando...' : isConfigured ? 'Trocar autenticador' : 'Configurar'}
				</Button>
			</CardContent>
		</Card>
	)
}
