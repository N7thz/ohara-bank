import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TAG_COLORS } from '@/lib/tags'

const updateSchema = z.object({
	name: z.string().trim().min(1).max(40).optional(),
	color: z.enum(TAG_COLORS).optional(),
	excludeFromTotals: z.boolean().optional(),
})

async function findOwnTag(request: Request, params: Promise<{ id: string }>) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const
	}

	const { id } = await params
	const tag = await prisma.tag.findUnique({ where: { id } })
	if (!tag || tag.userId !== session.user.id) {
		return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const
	}

	return { tag } as const
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const result = await findOwnTag(request, params)
	if ('error' in result) return result.error
	const { tag } = result

	const body = updateSchema.safeParse(await request.json().catch(() => null))
	if (!body.success) {
		return NextResponse.json({ error: 'Dados da tag inválidos' }, { status: 400 })
	}

	const { name } = body.data
	if (name && name !== tag.name) {
		const existing = await prisma.tag.findUnique({
			where: { userId_name: { userId: tag.userId, name } },
		})
		if (existing) {
			return NextResponse.json({ error: `A tag "${name}" já existe` }, { status: 409 })
		}
	}

	const updated = await prisma.tag.update({ where: { id: tag.id }, data: body.data })

	return NextResponse.json({
		id: updated.id,
		name: updated.name,
		color: updated.color,
		excludeFromTotals: updated.excludeFromTotals,
	})
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const result = await findOwnTag(request, params)
	if ('error' in result) return result.error

	await prisma.tag.delete({ where: { id: result.tag.id } })

	return new NextResponse(null, { status: 204 })
}
