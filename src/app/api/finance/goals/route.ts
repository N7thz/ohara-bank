import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { localToday } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { goalInputSchema, parseTargetMonth, serializeGoal } from './schema'

export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const where = { userId: session.user.id }
	const [goals, totals] = await Promise.all([
		prisma.goal.findMany({
			where,
			orderBy: { createdAt: 'asc' },
			include: { contributions: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 10 } },
		}),
		prisma.goalContribution.groupBy({
			by: ['goalId'],
			where: { goal: where },
			_sum: { amount: true },
		}),
	])
	const savedByGoal = new Map(totals.map((row) => [row.goalId, row._sum.amount ?? 0]))
	const today = localToday()

	return NextResponse.json({
		goals: goals.map((goal) => serializeGoal(goal, savedByGoal.get(goal.id) ?? 0, today)),
	})
}

export async function POST(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const body = goalInputSchema.safeParse(await request.json().catch(() => null))
	if (!body.success) {
		return NextResponse.json({ error: 'Dados da meta inválidos' }, { status: 400 })
	}

	const goal = await prisma.goal.create({
		data: {
			userId: session.user.id,
			name: body.data.name,
			targetAmount: body.data.targetAmount,
			targetMonth: parseTargetMonth(body.data.targetMonth),
		},
	})

	return NextResponse.json({ id: goal.id }, { status: 201 })
}
