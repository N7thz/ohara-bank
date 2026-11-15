import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { twoFactor } from 'better-auth/plugins'
import { prisma } from '@/lib/prisma'
import { totpSignIn } from './totp-sign-in'

/** Caminhos que mexem no autenticador e nas passkeys: exigem uma sessão recente */
const FRESH_SESSION_PATHS = new Set([
	'/two-factor/enable',
	'/two-factor/disable',
	'/two-factor/get-totp-uri',
	'/passkey/generate-register-options',
	'/passkey/verify-registration',
])
const FRESH_SESSION_MS = 10 * 60 * 1000

const appUrl = new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000')

// App de um usuário só, sem senha: entra com passkey ou, de reserva, com o
// código do autenticador. O usuário e o primeiro autenticador vêm do seed.
export const auth = betterAuth({
	appName: 'Ohara Bank',
	database: prismaAdapter(prisma, {
		provider: 'postgresql',
	}),
	hooks: {
		// Quem rouba uma sessão por alguns minutos não consegue trocar o autenticador nem
		// registrar uma passkey própria
		before: createAuthMiddleware(async (ctx) => {
			if (!FRESH_SESSION_PATHS.has(ctx.path)) return
			const session = await getSessionFromCtx(ctx)
			if (!session) return
			if (Date.now() - new Date(session.session.createdAt).getTime() > FRESH_SESSION_MS) {
				throw APIError.from('FORBIDDEN', {
					code: 'SESSION_NOT_FRESH',
					message: 'Entre de novo para alterar a segurança da conta.',
				})
			}
		}),
	},
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
