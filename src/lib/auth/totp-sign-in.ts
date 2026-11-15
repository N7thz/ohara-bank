import type { BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { symmetricDecrypt } from 'better-auth/crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { matchingStep } from './totp-step'

export const MAX_ATTEMPTS = 5
export const LOCK_MINUTES = 15

interface TwoFactorRow {
	id: string
	secret: string
	verified: boolean | null
	failedVerificationCount: number | null
	lockedUntil: Date | null
	lastUsedStep?: number | null
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

					const lockedError = () =>
						APIError.from('TOO_MANY_REQUESTS', {
							code: 'TOTP_LOCKED',
							message: 'Muitas tentativas. Tente de novo em alguns minutos.',
						})

					// Contador nulo (linhas antigas) vira 0 para o UPDATE condicional abaixo
					await prisma.twoFactor.updateMany({
						where: { id: twoFactor.id, failedVerificationCount: null },
						data: { failedVerificationCount: 0 },
					})

					// Reserva a tentativa ANTES de verificar, num único UPDATE condicional:
					// requisições simultâneas não leem o mesmo contador
					const reserved = await prisma.twoFactor.updateMany({
						where: {
							id: twoFactor.id,
							OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }],
							failedVerificationCount: { lt: MAX_ATTEMPTS },
						},
						data: { failedVerificationCount: { increment: 1 }, lockedUntil: null },
					})
					if (reserved.count === 0) {
						// Esgotou: bloqueia (se ainda não estava) e recusa
						await prisma.twoFactor.updateMany({
							where: {
								id: twoFactor.id,
								OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }],
							},
							data: {
								lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000),
								failedVerificationCount: 0,
							},
						})
						throw lockedError()
					}

					const secret = await symmetricDecrypt({
						key: ctx.context.secretConfig,
						data: twoFactor.secret,
					})
					const step = await matchingStep(secret, ctx.body.code)
					// Código já usado (mesmo passo ou anterior) não vale de novo
					if (step === null || (twoFactor.lastUsedStep != null && step <= twoFactor.lastUsedStep)) {
						throw invalid()
					}

					// Gravação condicional: dois logins simultâneos com o mesmo código não passam
					const consumed = await prisma.twoFactor.updateMany({
						where: {
							id: twoFactor.id,
							OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }],
						},
						data: { lastUsedStep: step, failedVerificationCount: 0, lockedUntil: null },
					})
					if (consumed.count === 0) throw invalid()

					const session = await ctx.context.internalAdapter.createSession(found.user.id)
					await setSessionCookie(ctx, { session, user: found.user })

					return ctx.json({ status: true })
				},
			),
		},
	}) satisfies BetterAuthPlugin
