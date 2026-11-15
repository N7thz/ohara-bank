import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { localTodayKey } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { contributionInputSchema } from '../../schema'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const { id } = await params
	const goal = await prisma.goal.findUnique({ where: { id } })
	if (!goal || goal.userId !== session.user.id) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}

	const body = contributionInputSchema.safeParse(await request.json().catch(() => null))
	if (!body.success) {
		return NextResponse.json({ error: 'Dados do valor inválidos' }, { status: 400 })
	}

	const contribution = await prisma.goalContribution.create({
		data: {
			goalId: goal.id,
			amount: body.data.amount,
			date: new Date(`${body.data.date ?? localTodayKey()}T00:00:00Z`),
			note: body.data.note || null,
		},
	})

	return NextResponse.json({ id: contribution.id }, { status: 201 })
}
