import { UTCDate } from '@date-fns/utc'
import { startOfMonth } from 'date-fns'

// Datas do app: transações e holerites são gravados à meia-noite UTC do dia. Sem Prisma
// aqui, para servir no servidor, no cliente e nos testes

export const TIME_ZONE = 'America/Sao_Paulo'

/** "AAAA-MM-DD" da parte UTC */
export const day = (date: Date) => date.toISOString().slice(0, 10)
/** "AAAA-MM" da parte UTC */
export const monthKey = (date: Date) => date.toISOString().slice(0, 7)
/** Primeiro dia do mês, à meia-noite UTC */
export const monthStart = (date: Date) => startOfMonth(new UTCDate(date))

/** Data de hoje em São Paulo à meia-noite UTC, como as transações são gravadas */
export function localClock(now: Date) {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-CA', {
			timeZone: TIME_ZONE,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			hourCycle: 'h23',
		})
			.formatToParts(now)
			.map((part) => [part.type, part.value]),
	)
	return {
		today: new UTCDate(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`),
		hour: Number(parts.hour),
	}
}

/** Hoje em São Paulo, à meia-noite UTC (o mesmo formato das datas das transações) */
export const localToday = (now = new Date()) => localClock(now).today
/** Primeiro dia do mês atual em São Paulo, à meia-noite UTC */
export const localMonthStart = (now = new Date()) => monthStart(localToday(now))
/** "AAAA-MM-DD" de hoje em São Paulo */
export const localTodayKey = (now = new Date()) => day(localToday(now))
/** "AAAA-MM" do mês atual em São Paulo */
export const localMonthKey = (now = new Date()) => monthKey(localToday(now))
