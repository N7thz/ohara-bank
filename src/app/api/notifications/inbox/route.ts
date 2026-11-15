import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/api-session'
import { refreshInbox } from '@/lib/notifications/inbox'
import { prisma } from '@/lib/prisma'

const LIMIT = 30

/** Avisos do sino: gera os novos (no máximo uma vez por minuto) e devolve os mais recentes */
export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response
	const userId = session.user.id

	await refreshInbox(userId)
	const [items, unread] = await Promise.all([
		prisma.notification.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			take: LIMIT,
			select: {
				id: true,
				kind: true,
				title: true,
				body: true,
				href: true,
				readAt: true,
				createdAt: true,
			},
		}),
		prisma.notification.count({ where: { userId, readAt: null } }),
	])

	return NextResponse.json({ items, unread })
}

const readSchema = z.object({
	/** Sem ids: marca todos como lidos */
	ids: z.array(z.string().min(1)).max(100).optional(),
})

/** Marca avisos como lidos */
export async function PATCH(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const body = readSchema.safeParse(await request.json().catch(() => null))
	if (!body.success) {
		return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
	}

	const { count } = await prisma.notification.updateMany({
		where: {
			userId: session.user.id,
			readAt: null,
			...(body.data.ids ? { id: { in: body.data.ids } } : {}),
		},
		data: { readAt: new Date() },
	})

	return NextResponse.json({ count })
}
