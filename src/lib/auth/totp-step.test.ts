import { describe, expect, test } from 'bun:test'
import { createOTP } from '@better-auth/utils/otp'
import { matchingStep } from './totp-step'

const SECRET = 'segredo-de-teste-totp'
const NOW = 1_800_000_000_000
const STEP = Math.floor(NOW / 30_000)
const codeAt = (step: number) => createOTP(SECRET, { digits: 6, period: 30 }).hotp(step)

describe('matchingStep', () => {
	test('devolve o passo do código atual', async () => {
		expect(await matchingStep(SECRET, await codeAt(STEP), NOW)).toBe(STEP)
	})

	test('aceita o passo anterior e o próximo', async () => {
		expect(await matchingStep(SECRET, await codeAt(STEP - 1), NOW)).toBe(STEP - 1)
		expect(await matchingStep(SECRET, await codeAt(STEP + 1), NOW)).toBe(STEP + 1)
	})

	test('código errado devolve null', async () => {
		const right = await codeAt(STEP)
		const wrong = right === '000000' ? '000001' : '000000'
		expect(await matchingStep(SECRET, wrong, NOW)).toBeNull()
	})

	test('código de 2 passos atrás devolve null', async () => {
		expect(await matchingStep(SECRET, await codeAt(STEP - 2), NOW)).toBeNull()
	})
})
