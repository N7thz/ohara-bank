import { createOTP } from '@better-auth/utils/otp'
import { generateRandomString, symmetricEncrypt } from 'better-auth/crypto'
import QRCode from 'qrcode'
import { auth } from '../src/lib/auth'
import { prisma } from '../src/lib/prisma'

// Cria o usuário único do app (sem senha) e configura o autenticador, que é
// a porta de entrada inicial: entre com o código e cadastre uma passkey em
// Segurança. Rode com --reset-totp para gerar um autenticador novo (recuperação).
const resetTotp = process.argv.includes('--reset-totp')

async function main() {
	const email = process.env.ADMIN_EMAIL
	const name = process.env.ADMIN_NAME ?? 'Admin'

	if (!email) {
		throw new Error('Defina ADMIN_EMAIL no .env')
	}

	const now = new Date()
	const user =
		(await prisma.user.findUnique({ where: { email } })) ??
		(await prisma.user.create({
			data: {
				id: crypto.randomUUID(),
				name,
				email,
				emailVerified: true,
				createdAt: now,
				updatedAt: now,
			},
		}))

	// Login por senha não existe mais: remove senhas antigas
	const { count: removedPasswords } = await prisma.account.deleteMany({
		where: { userId: user.id, providerId: 'credential' },
	})
	if (removedPasswords > 0) console.log('✓ Senha antiga removida')

	const existing = await prisma.twoFactor.findFirst({ where: { userId: user.id } })
	if (existing && existing.verified !== false && !resetTotp) {
		console.log(`Usuário ${email} já tem autenticador. Use --reset-totp para gerar outro.`)
		return
	}

	const { secretConfig } = await auth.$context
	const secret = generateRandomString(32)
	const data = {
		secret: await symmetricEncrypt({ key: secretConfig, data: secret }),
		backupCodes: await symmetricEncrypt({ key: secretConfig, data: '[]' }),
		verified: true,
		failedVerificationCount: 0,
		lockedUntil: null,
	}

	await prisma.twoFactor.deleteMany({ where: { userId: user.id } })
	await prisma.twoFactor.create({ data: { id: crypto.randomUUID(), userId: user.id, ...data } })
	await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } })

	const uri = createOTP(secret, { digits: 6, period: 30 }).url('Ohara Bank', email)

	console.log(`\n✓ Autenticador configurado para ${email}`)
	console.log('Escaneie no Google Authenticator / Authy:\n')
	console.log(await QRCode.toString(uri, { type: 'terminal', small: true }))
	// O app autenticador espera a chave em base32, como vai no QR code
	console.log(`Ou digite a chave manualmente: ${new URL(uri).searchParams.get('secret')}\n`)
	console.log('Depois entre em http://localhost:3000 com "Usar código do autenticador"')
	console.log('e cadastre uma passkey em Segurança.')
}

main()
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
	.finally(() => prisma.$disconnect())
