import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const accounts = await prisma.bankAccount.findMany({
		where: { userId: session.user.id },
		orderBy: [{ bankName: 'asc' }, { type: 'asc' }],
		include: { _count: { select: { transactions: true } } },
	})

	return NextResponse.json(
		accounts.map(({ _count, balance, ...account }) => ({
			...account,
			balance: balance === null ? null : Number(balance),
			transactionCount: _count.transactions,
		})),
	)
}
