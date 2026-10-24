import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { twoFactor } from 'better-auth/plugins'
import { prisma } from '@/lib/prisma'
import { totpSignIn } from './totp-sign-in'

const appUrl = new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000')

// App de um usuário só, sem senha: entra com passkey ou, de reserva, com o
// código do autenticador. O usuário e o primeiro autenticador vêm do seed.
export const auth = betterAuth({
	appName: 'Ohara Bank',
	database: prismaAdapter(prisma, {
		provider: 'postgresql',
	}),
	plugins: [
		passkey({
			rpID: appUrl.hostname,
			rpName: 'Ohara Bank',
			origin: appUrl.origin,
		}),
		// Só para gerenciar o autenticador na tela de Segurança
		twoFactor({ allowPasswordless: true }),
		totpSignIn(),
		nextCookies(),
	],
})
