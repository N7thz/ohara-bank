import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const payslips = await prisma.payslip.findMany({
		where: { userId: session.user.id },
		orderBy: { competence: 'desc' },
		include: { items: { orderBy: { code: 'asc' } } },
	})

	return NextResponse.json(
		payslips.map(({ grossAmount, deductionsAmount, netAmount, fgtsAmount, items, ...payslip }) => ({
			...payslip,
			grossAmount: Number(grossAmount),
			deductionsAmount: Number(deductionsAmount),
			netAmount: Number(netAmount),
			fgtsAmount: fgtsAmount === null ? null : Number(fgtsAmount),
			items: items.map(({ amount, ...item }) => ({ ...item, amount: Number(amount) })),
		})),
	)
}
