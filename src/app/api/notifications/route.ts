import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/api-session'
import { getEmailSettings } from '@/lib/email/jobs'
import { isEmailConfigured } from '@/lib/email/transport'
import { prisma } from '@/lib/prisma'

const settingsSchema = z.object({
	billReminders: z.boolean(),
	billReminderDays: z.number().int().min(0).max(15),
	weeklySummary: z.boolean(),
	monthlySummary: z.boolean(),
	budgetAlerts: z.boolean(),
})

function toResponse(settings: z.infer<typeof settingsSchema>) {
	const { billReminders, billReminderDays, weeklySummary, monthlySummary, budgetAlerts } = settings
	return { billReminders, billReminderDays, weeklySummary, monthlySummary, budgetAlerts }
}

export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const [settings, logs] = await Promise.all([
		getEmailSettings(session.user.id),
		prisma.emailLog.findMany({
			where: { userId: session.user.id },
			orderBy: { sentAt: 'desc' },
			take: 20,
			select: { id: true, kind: true, subject: true, error: true, sentAt: true },
		}),
	])

	return NextResponse.json({
		settings: toResponse(settings),
		/** SMTP_USER e SMTP_PASS no .env */
		configured: isEmailConfigured(),
		recipient: session.user.email,
		logs,
	})
}

export async function PUT(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const body = settingsSchema.safeParse(await request.json().catch(() => null))
	if (!body.success) {
		return NextResponse.json({ error: 'Configuração inválida' }, { status: 400 })
	}

	const settings = await prisma.emailSettings.upsert({
		where: { userId: session.user.id },
		create: { userId: session.user.id, ...body.data },
		update: body.data,
	})

	return NextResponse.json(toResponse(settings))
}
