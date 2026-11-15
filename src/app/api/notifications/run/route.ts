import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { checkEmails } from '@/lib/email/scheduler'
import { isEmailConfigured } from '@/lib/email/transport'

/** "Verificar agora": envia o que estiver pendente sem esperar o próximo ciclo nem as 8h */
export async function POST(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response
	if (!isEmailConfigured()) {
		return NextResponse.json(
			{ error: 'Configure SMTP_USER e SMTP_PASS no .env e reinicie o app' },
			{ status: 400 },
		)
	}

	const results = await checkEmails({ userId: session.user.id, ignoreHour: true })
	return NextResponse.json({ results })
}
