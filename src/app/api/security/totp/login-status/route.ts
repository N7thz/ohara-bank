import { NextResponse } from 'next/server'
import { getTotpStatus } from '@/lib/auth/totp-status'
import { prisma } from '@/lib/prisma'

// Público (tela de login): o login com código só vale para o ADMIN_EMAIL
export async function GET() {
	const email = process.env.ADMIN_EMAIL
	const user = email
		? await prisma.user.findUnique({ where: { email }, select: { id: true } })
		: null

	// Sem contadores: números de tentativas ajudariam a dosar palpites
	const { status, lockedUntil } = await getTotpStatus(user?.id)
	return NextResponse.json({ status, lockedUntil: status === 'locked' ? lockedUntil : null })
}
