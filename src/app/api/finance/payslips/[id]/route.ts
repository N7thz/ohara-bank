import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const { id } = await params
	const payslip = await prisma.payslip.findUnique({ where: { id } })

	if (!payslip || payslip.userId !== session.user.id) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}

	await prisma.payslip.delete({ where: { id } })

	return new NextResponse(null, { status: 204 })
}
