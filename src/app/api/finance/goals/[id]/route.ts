import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { prisma } from '@/lib/prisma'
import { goalPatchSchema, parseTargetMonth } from '../schema'

async function findOwnGoal(request: Request, params: Promise<{ id: string }>) {
	const { session, response } = await requireSession(request)
	if (!session) return { error: response } as const

	const { id } = await params
	const goal = await prisma.goal.findUnique({ where: { id } })
	if (!goal || goal.userId !== session.user.id) {
		return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const
	}
	return { goal } as const
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const result = await findOwnGoal(request, params)
	if ('error' in result) return result.error

	const body = goalPatchSchema.safeParse(await request.json().catch(() => null))
	if (!body.success) {
		return NextResponse.json({ error: 'Dados da meta inválidos' }, { status: 400 })
	}

	await prisma.goal.update({
		where: { id: result.goal.id },
		data: {
			name: body.data.name,
			targetAmount: body.data.targetAmount,
			// undefined mantém; null remove o prazo
			targetMonth:
				body.data.targetMonth === undefined ? undefined : parseTargetMonth(body.data.targetMonth),
		},
	})

	return NextResponse.json({ id: result.goal.id })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const result = await findOwnGoal(request, params)
	if ('error' in result) return result.error

	await prisma.goal.delete({ where: { id: result.goal.id } })

	return new NextResponse(null, { status: 204 })
}
