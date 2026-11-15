import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const { id } = await params
	const account = await prisma.bankAccount.findUnique({ where: { id } })

	if (!account || account.userId !== session.user.id) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}

	await prisma.bankAccount.delete({ where: { id } })

	return new NextResponse(null, { status: 204 })
}
