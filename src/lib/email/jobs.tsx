import { UTCDate } from '@date-fns/utc'
import {
	addDays,
	addMonths,
	addWeeks,
	differenceInCalendarDays,
	startOfMonth,
	startOfWeek,
	subDays,
} from 'date-fns'
import { render } from 'react-email'
import BillReminder, { type BillReminderProps, dueLabel } from '@/emails/bill-reminder'
import BudgetAlert, { type BudgetAlertProps } from '@/emails/budget-alert'
import PeriodSummary from '@/emails/period-summary'
import { day, localClock, monthKey } from '@/lib/dates'
import { getDebtsOverview } from '@/lib/debts/overview'
import { formatPeriodLong } from '@/lib/format'
import { maximum, subtract, toMoney, toReais, zeroMoney } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { budgetUsage, importedUntil, periodReport } from './reports'
import { isEmailConfigured, sendEmail } from './transport'

// Os e-mails automáticos: cada um vira uma lista de avisos (chaves). Um aviso já enviado
// não é enviado de novo, então rodar várias vezes por dia é seguro

export type EmailKind = 'bills' | 'weekly' | 'monthly' | 'budget' | 'test'

/** Antes disso, os envios agendados esperam */
const SEND_FROM_HOUR = 8
/** Até quantas semanas para trás um resumo semanal ainda sai quando o extrato chega */
const WEEKLY_LOOKBACK = 4

interface PendingEmail {
	kind: EmailKind
	subject: string
	html: string
	text: string
	keys: string[]
}

// Reexportado: a rota de teste e a caixa de notificações importam daqui
export { localClock }

/** HTML e texto puro do mesmo template; o texto vai para quem não abre HTML */
async function renderEmail(element: React.ReactElement) {
	const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
	return { html, text }
}

// --- Contas a vencer e atrasadas ---

export async function billsEmail(userId: string, today: Date, days: number, sent: Set<string>) {
	const overview = await getDebtsOverview(userId, today)
	const month = monthKey(today)
	const lastDay = new Date(
		Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
	).getUTCDate()

	const late: BillReminderProps['late'] = []
	const soon: BillReminderProps['soon'] = []
	const keys: string[] = []

	for (const debt of overview.debts) {
		if (!debt.dueDay) continue
		const bill = {
			id: debt.id,
			name: debt.name,
			remaining: toReais(
				maximum([subtract(toMoney(debt.amount), toMoney(debt.paidThisMonth)), zeroMoney()]),
			),
			dueDay: debt.dueDay,
		}
		if (debt.status === 'late') {
			const key = `bill:${debt.id}:${month}:late`
			if (sent.has(key)) continue
			keys.push(key)
			late.push(bill)
		} else if (debt.status === 'pending' || debt.status === 'partial') {
			const due = new Date(
				Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), Math.min(debt.dueDay, lastDay)),
			)
			const inDays = differenceInCalendarDays(due, today)
			const key = `bill:${debt.id}:${month}:soon`
			if (inDays < 0 || inDays > days || sent.has(key)) continue
			keys.push(key)
			soon.push({ ...bill, inDays })
		}
	}
	if (keys.length === 0) return null

	soon.sort((a, b) => a.inDays - b.inDays)
	const subject =
		late.length > 0
			? `${late.length} ${late.length === 1 ? 'conta atrasada' : 'contas atrasadas'}${soon.length > 0 ? ` e ${soon.length} vencendo` : ''}`
			: soon.length === 1
				? `${soon[0].name} ${dueLabel(soon[0].inDays)}`
				: `${soon.length} contas vencendo`

	return {
		kind: 'bills',
		subject,
		...(await renderEmail(
			<BillReminder
				title={subject}
				late={late}
				soon={soon}
				importedUntil={overview.importedUntil}
			/>,
		)),
		keys,
	} satisfies PendingEmail
}

// --- Resumos semanal e mensal ---

/**
 * Semana mais recente (segunda a domingo) já coberta pelos extratos. Com force, a última
 * semana completa mesmo sem extrato (e-mail de teste)
 */
export async function weeklyEmail(userId: string, today: Date, sent: Set<string>, force = false) {
	const until = await importedUntil(userId)
	if (!until) return null

	const thisWeek = startOfWeek(new UTCDate(today), { weekStartsOn: 1 })
	let start: Date | null = null
	for (let back = 1; back <= WEEKLY_LOOKBACK; back++) {
		const candidate = addWeeks(thisWeek, -back)
		if (force || until >= addDays(candidate, 6)) {
			start = candidate
			break
		}
	}
	if (!start) return null

	const key = `weekly:${day(start)}`
	if (!force && sent.has(key)) return null

	const end = addWeeks(start, 1)
	const [report, previous] = await Promise.all([
		periodReport(userId, start, end),
		periodReport(userId, addWeeks(start, -1), start),
	])
	if (report.count === 0 && !force) return null

	const label = formatPeriodLong('week', { start: day(start), end: day(subDays(end, 1)) })
	const subject = `Resumo da semana: ${label}`
	return {
		kind: 'weekly',
		subject,
		...(await renderEmail(
			<PeriodSummary
				title={subject}
				unit="semana"
				report={report}
				previous={previous.count > 0 ? previous : undefined}
				previousLabel="a semana anterior"
			/>,
		)),
		keys: [key],
	} satisfies PendingEmail
}

/** Mês anterior, quando os extratos já cobrem o mês inteiro */
export async function monthlyEmail(userId: string, today: Date, sent: Set<string>) {
	const start = addMonths(startOfMonth(new UTCDate(today)), -1)
	const end = addMonths(start, 1)
	const key = `monthly:${monthKey(start)}`
	if (sent.has(key)) return null

	const until = await importedUntil(userId)
	if (!until || until < subDays(end, 1)) return null

	const [report, previous] = await Promise.all([
		periodReport(userId, start, end),
		periodReport(userId, addMonths(start, -1), start),
	])
	if (report.count === 0) return null

	const label = formatPeriodLong('month', { start: day(start), end: day(subDays(end, 1)) })
	const subject = `Resumo de ${label}`
	return {
		kind: 'monthly',
		subject,
		...(await renderEmail(
			<PeriodSummary
				title={subject}
				unit="mês"
				report={report}
				previous={previous.count > 0 ? previous : undefined}
				previousLabel="o mês anterior"
			/>,
		)),
		keys: [key],
	} satisfies PendingEmail
}

// --- Orçamento: avisa ao passar de 80% e de 100% ---

export async function budgetEmail(userId: string, today: Date, sent: Set<string>) {
	const start = startOfMonth(new UTCDate(today))
	const end = addMonths(start, 1)
	const month = monthKey(start)
	const usage = await budgetUsage(userId, start, end)

	const alerts: BudgetAlertProps['alerts'] = []
	const keys: string[] = []
	for (const item of usage) {
		const level = item.ratio >= 1 ? 100 : item.ratio >= 0.8 ? 80 : null
		if (!level) continue
		const key = `budget:${item.tagId}:${month}:${level}`
		if (sent.has(key)) continue
		// Passou direto dos 100%: o aviso de 80% não vem depois
		keys.push(key, ...(level === 100 ? [`budget:${item.tagId}:${month}:80`] : []))
		alerts.push({
			tagId: item.tagId,
			name: item.name,
			spent: item.spent,
			budget: item.budget,
			level,
		})
	}
	if (alerts.length === 0) return null

	alerts.sort((a, b) => b.spent / b.budget - a.spent / a.budget)
	const subject =
		alerts.length === 1
			? `Orçamento de ${alerts[0].name}: ${Math.round((alerts[0].spent / alerts[0].budget) * 100)}% usado`
			: `${alerts.length} orçamentos perto do limite`

	return {
		kind: 'budget',
		subject,
		...(await renderEmail(<BudgetAlert title={subject} alerts={alerts} />)),
		keys,
	} satisfies PendingEmail
}

// --- Execução ---

export const DEFAULT_EMAIL_SETTINGS = {
	billReminders: true,
	billReminderDays: 3,
	weeklySummary: true,
	monthlySummary: true,
	budgetAlerts: true,
}

export function getEmailSettings(userId: string) {
	return prisma.emailSettings.upsert({
		where: { userId },
		create: { userId, ...DEFAULT_EMAIL_SETTINGS },
		update: {},
	})
}

async function sentKeys(userId: string) {
	const logs = await prisma.emailLog.findMany({
		where: { userId, error: null, sentAt: { gte: subDays(new Date(), 120) } },
		select: { keys: true },
	})
	return new Set(logs.flatMap((log) => log.keys))
}

/**
 * Reserva as chaves no banco, envia e registra. Falha também fica no registro, sem as chaves,
 * para tentar de novo. Devolve null quando outra verificação já pegou o aviso.
 */
export async function deliver(user: { id: string; email: string }, email: PendingEmail) {
	const startedAt = new Date()
	if (email.keys.length > 0) {
		const claimed = await prisma.emailKeyClaim.createMany({
			data: email.keys.map((key) => ({ userId: user.id, key })),
			skipDuplicates: true,
		})
		// Outra verificação já pegou (alguma de) essas chaves: não envia
		if (claimed.count < email.keys.length) {
			await prisma.emailKeyClaim.deleteMany({
				where: { userId: user.id, key: { in: email.keys }, claimedAt: { gte: startedAt } },
			})
			return null
		}
	}

	try {
		await sendEmail({ to: user.email, subject: email.subject, html: email.html, text: email.text })
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		// Libera as chaves desta tentativa para permitir o reenvio depois
		await prisma.emailKeyClaim.deleteMany({
			where: { userId: user.id, key: { in: email.keys } },
		})
		await prisma.emailLog.create({
			data: { userId: user.id, kind: email.kind, subject: email.subject, keys: [], error: message },
		})
		return { kind: email.kind, subject: email.subject, error: message }
	}

	// Enviou: daqui para frente nada pode virar "falha de envio"
	try {
		await prisma.emailLog.create({
			data: { userId: user.id, kind: email.kind, subject: email.subject, keys: email.keys },
		})
	} catch (error) {
		console.error('[e-mail] enviado, mas não registrado', error)
	}
	return { kind: email.kind, subject: email.subject, error: null }
}

// Uma falha (senha errada, sem internet) não vira um e-mail de erro a cada 15 minutos
const RETRY_AFTER_MS = 60 * 60 * 1000

interface RunOptions {
	now?: Date
	/** Só este usuário (ex.: depois de importar um extrato) */
	userId?: string
	/** Ignora o horário mínimo (botão "Verificar agora") */
	ignoreHour?: boolean
}

/** Monta e envia os e-mails pendentes; devolve o que foi enviado ou falhou */
export async function runEmailJobs({
	now = new Date(),
	userId,
	ignoreHour = false,
}: RunOptions = {}) {
	if (!isEmailConfigured()) return []

	const { today, hour } = localClock(now)
	if (!ignoreHour && hour < SEND_FROM_HOUR) return []

	const users = await prisma.user.findMany({
		where: userId ? { id: userId } : {},
		select: { id: true, email: true },
	})

	const results: NonNullable<Awaited<ReturnType<typeof deliver>>>[] = []
	for (const user of users) {
		const lastError = await prisma.emailLog.findFirst({
			where: {
				userId: user.id,
				error: { not: null },
				sentAt: { gte: new Date(now.getTime() - RETRY_AFTER_MS) },
			},
			select: { id: true },
		})
		if (lastError && !ignoreHour) continue

		const settings = await getEmailSettings(user.id)
		const sent = await sentKeys(user.id)
		const pending = await Promise.all([
			settings.billReminders ? billsEmail(user.id, today, settings.billReminderDays, sent) : null,
			settings.weeklySummary ? weeklyEmail(user.id, today, sent) : null,
			settings.monthlySummary ? monthlyEmail(user.id, today, sent) : null,
			settings.budgetAlerts ? budgetEmail(user.id, today, sent) : null,
		])

		for (const email of pending) {
			if (!email) continue
			const result = await deliver(user, email)
			if (result) results.push(result)
		}
	}
	return results
}
