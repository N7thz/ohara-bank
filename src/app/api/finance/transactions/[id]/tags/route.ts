import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/api-session'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
	tagIds: z.array(z.string()).max(20),
})

/** Substitui as tags da transação */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const { id } = await params
	const transaction = await prisma.transaction.findUnique({
		where: { id },
		include: { account: { select: { userId: true } } },
	})
	if (!transaction || transaction.account.userId !== session.user.id) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}

	const body = bodySchema.safeParse(await request.json().catch(() => null))
	if (!body.success) {
		return NextResponse.json({ error: 'Tags inválidas' }, { status: 400 })
	}

	const tagIds = [...new Set(body.data.tagIds)]
	const ownTags = await prisma.tag.count({ where: { id: { in: tagIds }, userId: session.user.id } })
	if (ownTags !== tagIds.length) {
		return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 })
	}

	await prisma.$transaction([
		prisma.transactionTag.deleteMany({ where: { transactionId: id, tagId: { notIn: tagIds } } }),
		prisma.transactionTag.createMany({
			data: tagIds.map((tagId) => ({ transactionId: id, tagId })),
			skipDuplicates: true,
		}),
	])

	return new NextResponse(null, { status: 204 })
}
