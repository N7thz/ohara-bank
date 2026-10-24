import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTotpStatus } from '@/lib/auth/totp-status'

export async function GET(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	return NextResponse.json({
		...(await getTotpStatus(session.user.id)),
		/** O login com código só vale para o ADMIN_EMAIL */
		loginAllowed: session.user.email === process.env.ADMIN_EMAIL,
	})
}
