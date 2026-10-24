import { prisma } from '@/lib/prisma'
import { MAX_ATTEMPTS } from './totp-sign-in'

export type TotpStatusKind = 'connected' | 'pending' | 'locked' | 'not-configured'

// Mesmas regras do /totp-sign-in: é isso que decide se o login com código funciona
export async function getTotpStatus(userId: string | undefined) {
	const twoFactor = userId
		? await prisma.twoFactor.findFirst({
				where: { userId },
				select: { verified: true, failedVerificationCount: true, lockedUntil: true },
			})
		: null

	const lockedUntil =
		twoFactor?.lockedUntil && twoFactor.lockedUntil > new Date() ? twoFactor.lockedUntil : null

	const status: TotpStatusKind = !twoFactor
		? 'not-configured'
		: twoFactor.verified === false
			? 'pending'
			: lockedUntil
				? 'locked'
				: 'connected'

	return {
		status,
		failedAttempts: twoFactor?.failedVerificationCount ?? 0,
		maxAttempts: MAX_ATTEMPTS,
		lockedUntil: lockedUntil?.toISOString() ?? null,
	}
}
