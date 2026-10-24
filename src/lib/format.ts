import { utc } from '@date-fns/utc'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { SummaryGranularity, SummaryPeriod } from '@/hooks/finance/summary'

// Formatação de valores, datas e períodos usada por todas as telas de finanças

export function formatCurrency(value: number) {
	return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Datas de extrato e holerite são gravadas à meia-noite UTC; formatar no fuso
// local (UTC−3) mostraria o dia anterior
export function formatDate(value: string) {
	return format(value, 'dd/MM/yyyy', { in: utc })
}

// 2026-09-01T00:00:00Z → 09/2026
export function formatCompetence(value: string) {
	return format(value, 'MM/yyyy', { in: utc })
}

const periodOptions = { in: utc, locale: ptBR }

/** Rótulo curto para o eixo: "set/26" ou "15/09" */
export function formatPeriodShort(
	granularity: SummaryGranularity,
	period: Pick<SummaryPeriod, 'start' | 'end'>,
) {
	return granularity === 'month'
		? format(period.start, 'MMM/yy', periodOptions)
		: format(period.start, 'dd/MM', periodOptions)
}

/** Rótulo completo: "setembro de 2026" ou "15/09 a 21/09/2026" */
export function formatPeriodLong(
	granularity: SummaryGranularity,
	period: Pick<SummaryPeriod, 'start' | 'end'>,
) {
	if (granularity === 'month') return format(period.start, "MMMM 'de' yyyy", periodOptions)
	return `${format(period.start, 'dd/MM', periodOptions)} a ${format(period.end, 'dd/MM/yyyy', periodOptions)}`
}

export function previousPeriodLabel(granularity: SummaryGranularity) {
	return granularity === 'month' ? 'mês anterior' : 'semana anterior'
}

// R$ 1,5 mil — ticks do eixo
export function formatCompactCurrency(value: number) {
	return value.toLocaleString('pt-BR', {
		style: 'currency',
		currency: 'BRL',
		notation: 'compact',
		maximumFractionDigits: 1,
	})
}
