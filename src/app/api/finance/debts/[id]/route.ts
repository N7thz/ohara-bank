import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { debtInputSchema, toDebtData } from '../schema'

async function findOwnDebt(request: Request, params: Promise<{ id: string }>) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const
	}

	const { id } = await params
	const debt = await prisma.debt.findUnique({ where: { id } })
	if (!debt || debt.userId !== session.user.id) {
		return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const
	}

	return { debt } as const
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const result = await findOwnDebt(request, params)
	if ('error' in result) return result.error

	const body = debtInputSchema.safeParse(await request.json().catch(() => null))
	if (!body.success) {
		return NextResponse.json({ error: 'Dados da dívida inválidos' }, { status: 400 })
	}

	await prisma.debt.update({ where: { id: result.debt.id }, data: toDebtData(body.data) })

	return NextResponse.json({ id: result.debt.id })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const result = await findOwnDebt(request, params)
	if ('error' in result) return result.error

	await prisma.debt.delete({ where: { id: result.debt.id } })

	return new NextResponse(null, { status: 204 })
}
