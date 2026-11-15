import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { prisma } from '@/lib/prisma'

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string; contributionId: string }> },
) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const { id, contributionId } = await params
	const contribution = await prisma.goalContribution.findUnique({
		where: { id: contributionId },
		include: { goal: true },
	})
	if (!contribution || contribution.goalId !== id || contribution.goal.userId !== session.user.id) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}

	await prisma.goalContribution.delete({ where: { id: contribution.id } })

	return new NextResponse(null, { status: 204 })
}
