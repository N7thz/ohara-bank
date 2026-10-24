import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { PasskeyManager } from './_components/passkey-manager'
import { TwoFactorSetup } from './_components/two-factor-setup'

export const metadata: Metadata = {
	title: 'Segurança',
	description: 'Passkeys e autenticação em dois fatores.',
}

export default function SecurityPage() {
	return (
		<div className="stagger page-stack">
			<PageHeader
				title="Segurança"
				description="Como você entra no app: passkey no dia a dia e o código do autenticador como reserva."
			/>
			<PageSection title="Formas de entrar">
				{/* Passkey mais larga que o autenticador: lado a lado, assimétrico */}
				<div className="stagger grid items-start gap-6 md:grid-cols-[3fr_2fr]">
					<PasskeyManager />
					<TwoFactorSetup />
				</div>
			</PageSection>
		</div>
	)
}
