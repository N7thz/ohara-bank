import { NextResponse } from 'next/server'
import { getTotpStatus } from '@/lib/auth/totp-status'
import { prisma } from '@/lib/prisma'

// Público (tela de login): o login com código só vale para o ADMIN_EMAIL
export async function GET() {
	const email = process.env.ADMIN_EMAIL
	const user = email
		? await prisma.user.findUnique({ where: { email }, select: { id: true } })
		: null

	return NextResponse.json(await getTotpStatus(user?.id))
}
