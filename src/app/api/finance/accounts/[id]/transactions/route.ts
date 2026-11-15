import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const { id } = await params
	const account = await prisma.bankAccount.findUnique({ where: { id } })

	if (!account || account.userId !== session.user.id) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}

	const transactions = await prisma.transaction.findMany({
		where: { accountId: id },
		orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
	})

	return NextResponse.json(
		transactions.map(({ amount, ...tx }) => ({ ...tx, amount: Number(amount) })),
	)
}
