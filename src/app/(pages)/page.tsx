import type { Metadata } from 'next'
import { LoginView } from './_components/login-view'

export const metadata: Metadata = {
	title: 'Entrar',
	description: 'Entre no Ohara Bank com passkey ou código do app autenticador.',
}

export default function LoginPage() {
	return <LoginView />
}
