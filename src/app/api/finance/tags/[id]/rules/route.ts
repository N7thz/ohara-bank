import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyTagRules } from '@/lib/tags'

const ruleSchema = z.object({
	pattern: z.string().trim().min(2).max(60),
})

/** Cria a regra e já aplica nas transações existentes */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const { id } = await params
	const tag = await prisma.tag.findUnique({ where: { id } })
	if (!tag || tag.userId !== session.user.id) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}

	const body = ruleSchema.safeParse(await request.json().catch(() => null))
	if (!body.success) {
		return NextResponse.json({ error: 'A regra precisa ter de 2 a 60 caracteres' }, { status: 400 })
	}

	const { pattern } = body.data
	const existing = await prisma.tagRule.findUnique({
		where: { tagId_pattern: { tagId: tag.id, pattern } },
	})
	if (existing) {
		return NextResponse.json({ error: `A regra "${pattern}" já existe nesta tag` }, { status: 409 })
	}

	const rule = await prisma.tagRule.create({ data: { tagId: tag.id, pattern } })
	const applied = await applyTagRules({ userId: session.user.id, ruleIds: [rule.id] })

	return NextResponse.json({ id: rule.id, pattern: rule.pattern, applied }, { status: 201 })
}
