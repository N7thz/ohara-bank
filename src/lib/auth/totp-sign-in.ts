import { createOTP } from '@better-auth/utils/otp'
import type { BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { symmetricDecrypt } from 'better-auth/crypto'
import { z } from 'zod'

export const MAX_ATTEMPTS = 5
export const LOCK_MINUTES = 15

interface TwoFactorRow {
	id: string
	secret: string
	verified: boolean | null
	failedVerificationCount: number | null
	lockedUntil: Date | null
}

/**
 * Login de reserva só com o código do autenticador (TOTP), sem senha.
 * Vale apenas para o usuário único do app (ADMIN_EMAIL) e bloqueia por
 * LOCK_MINUTES depois de MAX_ATTEMPTS códigos errados seguidos.
 */
export const totpSignIn = () =>
	({
		id: 'totp-sign-in',
		endpoints: {
			totpSignIn: createAuthEndpoint(
				'/totp-sign-in',
				{
					method: 'POST',
					body: z.object({ code: z.string().regex(/^\d{6}$/) }),
				},
				async (ctx) => {
					const invalid = () =>
						APIError.from('UNAUTHORIZED', {
							code: 'INVALID_TOTP_CODE',
							message: 'Código inválido',
						})

					const email = process.env.ADMIN_EMAIL
					const found = email ? await ctx.context.internalAdapter.findUserByEmail(email) : null
					if (!found) throw invalid()

					const twoFactor = await ctx.context.adapter.findOne<TwoFactorRow>({
						model: 'twoFactor',
						where: [{ field: 'userId', value: found.user.id }],
					})
					// Autenticador ainda não confirmado não serve para entrar
					if (!twoFactor || twoFactor.verified === false) throw invalid()

					if (twoFactor.lockedUntil && new Date(twoFactor.lockedUntil) > new Date()) {
						throw APIError.from('TOO_MANY_REQUESTS', {
							code: 'TOTP_LOCKED',
							message: 'Muitas tentativas. Tente de novo em alguns minutos.',
						})
					}

					const secret = await symmetricDecrypt({
						key: ctx.context.secretConfig,
						data: twoFactor.secret,
					})
					const valid = await createOTP(secret, { digits: 6, period: 30 }).verify(ctx.body.code)

					if (!valid) {
						const failures = (twoFactor.failedVerificationCount ?? 0) + 1
						const locked = failures >= MAX_ATTEMPTS

						await ctx.context.adapter.update({
							model: 'twoFactor',
							where: [{ field: 'id', value: twoFactor.id }],
							update: {
								failedVerificationCount: locked ? 0 : failures,
								lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
							},
						})
						throw invalid()
					}

					await ctx.context.adapter.update({
						model: 'twoFactor',
						where: [{ field: 'id', value: twoFactor.id }],
						update: { failedVerificationCount: 0, lockedUntil: null },
					})

					const session = await ctx.context.internalAdapter.createSession(found.user.id)
					await setSessionCookie(ctx, { session, user: found.user })

					return ctx.json({ status: true })
				},
			),
		},
	}) satisfies BetterAuthPlugin
