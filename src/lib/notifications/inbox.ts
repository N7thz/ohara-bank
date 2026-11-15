import { subDays } from 'date-fns'
import {
	billsEmail,
	budgetEmail,
	type EmailKind,
	getEmailSettings,
	localClock,
	monthlyEmail,
	weeklyEmail,
} from '@/lib/email/jobs'
import { prisma } from '@/lib/prisma'

// Avisos dentro do app: os mesmos dos e-mails (contas, resumos, orçamento), mas gravados na
// caixa de entrada do usuário. Seguem as mesmas preferências da página de Notificações, mas
// não dependem do SMTP nem do horário mínimo dos e-mails

export type NotificationKind = Exclude<EmailKind, 'test'>

/** Texto curto e página de cada tipo de aviso */
const DETAILS: Record<NotificationKind, { body: string; href: string }> = {
	bills: { body: 'Confira os vencimentos em Dívidas.', href: '/dashboard/finance/debts' },
	weekly: { body: 'Entradas, saídas e onde mais gastou na semana.', href: '/dashboard' },
	monthly: { body: 'Entradas, saídas e onde mais gastou no mês.', href: '/dashboard' },
	budget: { body: 'Veja o orçamento das tags no resumo.', href: '/dashboard' },
}

/** Sem gerar de novo a cada abertura do sino */
const MIN_INTERVAL_MS = 60 * 1000

// No dev o módulo recarrega: trava e horário da última geração ficam no global
const globalForInbox = globalThis as unknown as {
	inboxRunning?: Set<string>
	inboxLastRun?: Map<string, number>
}
globalForInbox.inboxRunning ??= new Set()
globalForInbox.inboxLastRun ??= new Map()
const running = globalForInbox.inboxRunning
const lastRun = globalForInbox.inboxLastRun

async function notifiedKeys(userId: string) {
	const rows = await prisma.notification.findMany({
		where: { userId, createdAt: { gte: subDays(new Date(), 120) } },
		select: { keys: true },
	})
	return new Set(rows.flatMap((row) => row.keys))
}

/** Grava os avisos novos do usuário; com force ignora o intervalo mínimo */
export async function refreshInbox(userId: string, { force = false, now = new Date() } = {}) {
	if (running.has(userId)) return 0
	if (!force && now.getTime() - (lastRun.get(userId) ?? 0) < MIN_INTERVAL_MS) return 0

	running.add(userId)
	lastRun.set(userId, now.getTime())
	try {
		const { today } = localClock(now)
		const [settings, sent] = await Promise.all([getEmailSettings(userId), notifiedKeys(userId)])
		const pending = await Promise.all([
			settings.billReminders ? billsEmail(userId, today, settings.billReminderDays, sent) : null,
			settings.weeklySummary ? weeklyEmail(userId, today, sent) : null,
			settings.monthlySummary ? monthlyEmail(userId, today, sent) : null,
			settings.budgetAlerts ? budgetEmail(userId, today, sent) : null,
		])

		const data = pending.flatMap((notice) => {
			if (!notice || notice.keys.length === 0) return []
			const kind = notice.kind as NotificationKind
			return [{ userId, kind, title: notice.subject, keys: notice.keys, ...DETAILS[kind] }]
		})
		if (data.length > 0) await prisma.notification.createMany({ data })
		return data.length
	} catch (error) {
		console.error('[notificações] erro ao gerar avisos', error)
		return 0
	} finally {
		running.delete(userId)
	}
}
