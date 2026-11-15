import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/api-session'
import { localMonthStart } from '@/lib/dates'
import { prisma } from '@/lib/prisma'

const statusSchema = z.object({
	/** null volta para a situação calculada pelas transações */
	status: z.enum(['PAID', 'PENDING', 'SKIPPED']).nullable(),
})

/** Marca à mão a situação da conta no mês atual */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const { id } = await params
	const debt = await prisma.debt.findUnique({ where: { id } })
	if (!debt || debt.userId !== session.user.id) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}
	// Na parcelada, as parcelas pagas vêm das transações
	if (debt.kind === 'INSTALLMENT') {
		return NextResponse.json(
			{ error: 'A situação da parcelada vem dos pagamentos' },
			{ status: 400 },
		)
	}

	const body = statusSchema.safeParse(await request.json().catch(() => null))
	if (!body.success) {
		return NextResponse.json({ error: 'Situação inválida' }, { status: 400 })
	}

	const month = localMonthStart()
	const key = { debtId_month: { debtId: debt.id, month } }
	const { status } = body.data

	if (status === null) {
		await prisma.debtStatusOverride.deleteMany({ where: { debtId: debt.id, month } })
	} else {
		await prisma.debtStatusOverride.upsert({
			where: key,
			create: { debtId: debt.id, month, status },
			update: { status },
		})
	}

	return NextResponse.json({ id: debt.id, status })
}
