import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/api-session'
import { prisma } from '@/lib/prisma'
import { TAG_COLORS } from '@/lib/tags'

const createSchema = z.object({
	name: z.string().trim().min(1).max(40),
	color: z.enum(TAG_COLORS).optional(),
	excludeFromTotals: z.boolean().optional(),
})

export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const tags = await prisma.tag.findMany({
		where: { userId: session.user.id },
		orderBy: { name: 'asc' },
		include: {
			rules: { select: { id: true, pattern: true }, orderBy: { createdAt: 'asc' } },
			_count: { select: { transactions: true } },
		},
	})

	return NextResponse.json(
		tags.map((tag) => ({
			id: tag.id,
			name: tag.name,
			color: tag.color,
			excludeFromTotals: tag.excludeFromTotals,
			monthlyBudget: tag.monthlyBudget === null ? null : Number(tag.monthlyBudget),
			rules: tag.rules,
			transactionCount: tag._count.transactions,
		})),
	)
}

export async function POST(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const body = createSchema.safeParse(await request.json().catch(() => null))
	if (!body.success) {
		return NextResponse.json({ error: 'Nome da tag inválido' }, { status: 400 })
	}

	const userId = session.user.id
	const { name } = body.data

	const existing = await prisma.tag.findUnique({ where: { userId_name: { userId, name } } })
	if (existing) {
		return NextResponse.json({ error: `A tag "${name}" já existe` }, { status: 409 })
	}

	// Sem cor escolhida, segue a ordem da paleta
	const count = await prisma.tag.count({ where: { userId } })
	const color = body.data.color ?? TAG_COLORS[count % TAG_COLORS.length]

	const { excludeFromTotals = false } = body.data
	const tag = await prisma.tag.create({ data: { userId, name, color, excludeFromTotals } })

	return NextResponse.json(
		{
			id: tag.id,
			name: tag.name,
			color: tag.color,
			excludeFromTotals: tag.excludeFromTotals,
			monthlyBudget: null,
			rules: [],
			transactionCount: 0,
		},
		{ status: 201 },
	)
}
