import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/** Sessão da requisição, ou a resposta 401 pronta para devolver */
export async function requireSession(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return {
			session: null,
			response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
		} as const
	}
	return { session, response: null } as const
}
