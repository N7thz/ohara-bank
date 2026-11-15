import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

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
