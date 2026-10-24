import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Remove a regra; as tags que ela já aplicou continuam nas transações */
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string; ruleId: string }> },
) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const { id, ruleId } = await params
	const rule = await prisma.tagRule.findUnique({ where: { id: ruleId }, include: { tag: true } })

	if (!rule || rule.tagId !== id || rule.tag.userId !== session.user.id) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}

	await prisma.tagRule.delete({ where: { id: ruleId } })

	return new NextResponse(null, { status: 204 })
}
