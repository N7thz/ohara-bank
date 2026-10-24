'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { PasskeySignIn } from './passkey-sign-in'
import { TotpForm } from './totp-form'

type Step = 'passkey' | 'totp'

export function LoginView() {
	const router = useRouter()
	const [step, setStep] = useState<Step>('passkey')

	function onSuccess() {
		router.push('/dashboard')
	}

	return (
		<main className="flex min-h-[100dvh] w-full items-center justify-center bg-background/60 px-4">
			<Card className="w-full max-w-sm">
				{step === 'passkey' && (
					<PasskeySignIn onSuccess={onSuccess} onUseTotp={() => setStep('totp')} />
				)}
				{step === 'totp' && (
					<TotpForm onSuccess={onSuccess} onUsePasskey={() => setStep('passkey')} />
				)}
			</Card>
		</main>
	)
}
