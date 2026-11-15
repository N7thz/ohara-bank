import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { deliver, localClock, weeklyEmail } from '@/lib/email/jobs'
import { isEmailConfigured } from '@/lib/email/transport'

/** Envia o resumo da última semana como teste, sem marcar o resumo como enviado */
export async function POST(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response
	if (!isEmailConfigured()) {
		return NextResponse.json(
			{ error: 'Configure SMTP_USER e SMTP_PASS no .env e reinicie o app' },
			{ status: 400 },
		)
	}

	const { today } = localClock(new Date())
	const email = await weeklyEmail(session.user.id, today, new Set(), true)
	if (!email) {
		return NextResponse.json({ error: 'Importe um extrato antes de testar' }, { status: 400 })
	}

	const result = await deliver(session.user, {
		...email,
		kind: 'test',
		subject: `[Teste] ${email.subject}`,
		keys: [],
	})
	if (!result || result.error) {
		return NextResponse.json(
			{ error: `Falha no envio: ${result?.error ?? 'envio já em andamento'}` },
			{ status: 502 },
		)
	}

	return NextResponse.json({ subject: result.subject, to: session.user.email })
}
