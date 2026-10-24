'use client'

import { FingerprintIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authClient } from '@/lib/auth/client'

interface PasskeySignInProps {
	onSuccess: () => void
	onUseTotp: () => void
}

export function PasskeySignIn({ onSuccess, onUseTotp }: PasskeySignInProps) {
	const [isPending, setIsPending] = useState(false)

	async function handleClick() {
		setIsPending(true)
		const { error } = await authClient.signIn.passkey()
		setIsPending(false)

		if (error) {
			// Fechar a janela do Windows Hello / navegador não é erro
			if (!('code' in error && error.code === 'AUTH_CANCELLED')) {
				toast.error('Não foi possível entrar com a passkey')
			}
			return
		}

		onSuccess()
	}

	return (
		<>
			<CardHeader>
				<CardTitle>Entrar</CardTitle>
				<CardDescription>Acesse sua conta Ohara Bank</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<Button onClick={handleClick} disabled={isPending} className="w-full">
					<FingerprintIcon />
					{isPending ? 'Aguardando...' : 'Entrar com passkey'}
				</Button>

				<Button type="button" variant="link" className="w-full" onClick={onUseTotp}>
					Usar código do autenticador
				</Button>
			</CardContent>
		</>
	)
}
