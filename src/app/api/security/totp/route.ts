import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { getTotpStatus } from '@/lib/auth/totp-status'

export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	return NextResponse.json({
		...(await getTotpStatus(session.user.id)),
		/** O login com código só vale para o ADMIN_EMAIL */
		loginAllowed: session.user.email === process.env.ADMIN_EMAIL,
	})
}
