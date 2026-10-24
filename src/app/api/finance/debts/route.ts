import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDebtsOverview } from '@/lib/debts/overview'
import { prisma } from '@/lib/prisma'
import { debtInputSchema, toDebtData } from './schema'

export async function GET(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	return NextResponse.json(await getDebtsOverview(session.user.id))
}

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const body = debtInputSchema.safeParse(await request.json().catch(() => null))
	if (!body.success) {
		return NextResponse.json({ error: 'Dados da dívida inválidos' }, { status: 400 })
	}

	const debt = await prisma.debt.create({
		data: { ...toDebtData(body.data), userId: session.user.id },
	})

	return NextResponse.json({ id: debt.id }, { status: 201 })
}
