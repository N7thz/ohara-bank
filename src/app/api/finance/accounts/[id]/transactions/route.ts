import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

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
