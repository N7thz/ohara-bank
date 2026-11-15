import { createOTP } from '@better-auth/utils/otp'

/** Passo (janela de 30 s) em que o código vale, entre o anterior, o atual e o próximo; null se nenhum */
export async function matchingStep(secret: string, code: string, now = Date.now()) {
	const otp = createOTP(secret, { digits: 6, period: 30 })
	const current = Math.floor(now / 30_000)
	for (const step of [current - 1, current, current + 1]) {
		if ((await otp.hotp(step)) === code) return step
	}
	return null
}
