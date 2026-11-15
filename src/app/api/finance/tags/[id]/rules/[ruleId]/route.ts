import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { prisma } from '@/lib/prisma'

/** Remove a regra; as tags que ela já aplicou continuam nas transações */
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string; ruleId: string }> },
) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const { id, ruleId } = await params
	const rule = await prisma.tagRule.findUnique({ where: { id: ruleId }, include: { tag: true } })

	if (!rule || rule.tagId !== id || rule.tag.userId !== session.user.id) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}

	await prisma.tagRule.delete({ where: { id: ruleId } })

	return new NextResponse(null, { status: 204 })
}
