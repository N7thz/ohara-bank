'use client'

import { utc } from '@date-fns/utc'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailySpending } from '@/hooks/finance/transactions'
import { localToday } from '@/lib/dates'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

const DAY_MS = 86_400_000
const WEEKDAY_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
// Intensidade de cada degrau; dia sem gasto fica neutro (bg-muted)
const LEVEL_MIX = [28, 48, 72, 100]

export const parseDay = (date: string) => new Date(`${date}T00:00:00Z`)
export const dayKey = (date: Date) => date.toISOString().slice(0, 10)
/** Segunda = 0 ... domingo = 6 */
export const weekdayIndex = (date: Date) => (date.getUTCDay() + 6) % 7

const levelColor = (mix: number) => `color-mix(in oklab, var(--primary) ${mix}%, transparent)`

/**
 * Intervalo mostrado: o mês filtrado inteiro, ou do primeiro ao último mês com gasto.
 * Dias futuros não contam como "sem gasto": o fim para em hoje, mas inclui o último dia com dados
 */
export function spendingRange(days: DailySpending[], month: string | null) {
	let start: Date
	let end: Date
	if (month) {
		const [year, monthIndex] = month.split('-').map(Number)
		start = new Date(Date.UTC(year, monthIndex - 1, 1))
		end = new Date(Date.UTC(year, monthIndex, 0))
	} else {
		if (days.length === 0) return null
		const first = parseDay(days[0].date)
		const last = parseDay(days[days.length - 1].date)
		start = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1))
		end = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 0))
	}
	const today = localToday().getTime()
	const lastData = days.length > 0 ? parseDay(days[days.length - 1].date).getTime() : 0
	const cap = new Date(Math.max(today, lastData))
	if (end > cap) end = cap
	if (end < start) end = start
	return { start, end }
}

// Quantis dos dias com gasto: um dia atípico não apaga o resto da escala
function thresholds(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b)
	return [0.25, 0.5, 0.75].map(
		(quantile) => sorted[Math.min(sorted.length - 1, Math.floor(quantile * sorted.length))],
	)
}

interface SpendingHeatmapProps {
	days: DailySpending[]
	/** AAAA-MM quando há mês filtrado */
	month: string | null
	/** Mostrando o resultado do filtro anterior enquanto o novo carrega */
	isStale?: boolean
}

export function SpendingHeatmap({ days, month, isStale }: SpendingHeatmapProps) {
	const range = spendingRange(days, month)
	const byDate = new Map(days.map((day) => [day.date, day]))
	const peak = days.reduce<DailySpending | null>(
		(top, day) => (!top || day.total > top.total ? day : top),
		null,
	)

	let content: ReactNode
	if (!range || !peak) {
		content = <p className="text-sm text-muted-foreground">Nenhuma saída no período.</p>
	} else {
		const cuts = thresholds(days.map((day) => day.total))
		const level = (total: number) => cuts.filter((cut) => total > cut).length

		// A grade começa na segunda-feira da semana do primeiro dia
		const gridStart = range.start.getTime() - weekdayIndex(range.start) * DAY_MS
		const weeks = Math.floor((range.end.getTime() - gridStart) / DAY_MS / 7) + 1
		const cells = Array.from({ length: weeks * 7 }, (_, index) => {
			const date = new Date(gridStart + index * DAY_MS)
			return { date, inRange: date >= range.start && date <= range.end }
		})

		// Rótulo do mês na primeira coluna em que o mês aparece
		let lastMonth = ''
		const monthLabels = Array.from({ length: weeks }, (_, week) => {
			const firstDay = cells.slice(week * 7, week * 7 + 7).find((cell) => cell.inRange)
			if (!firstDay) return ''
			const key = format(firstDay.date, 'yyyy-MM', { in: utc })
			if (key === lastMonth) return ''
			lastMonth = key
			return format(firstDay.date, 'MMM', { in: utc, locale: ptBR })
		})
		const columns = `repeat(${weeks}, 1rem)`

		content = (
			<div className="flex flex-col gap-3">
				{/* A rolagem fica aqui dentro: a página nunca rola de lado */}
				<div className="overflow-x-auto pb-2">
					<div className="flex w-max gap-2">
						<div
							className="grid grid-rows-7 gap-[3px] pt-5 text-xs text-muted-foreground"
							aria-hidden="true"
						>
							{WEEKDAY_LABELS.map((label) => (
								<span key={label} className="h-4 leading-4">
									{label}
								</span>
							))}
						</div>
						<div className="flex flex-col gap-1">
							<div
								className="grid h-4 gap-[3px] text-xs leading-4 text-muted-foreground"
								style={{ gridTemplateColumns: columns }}
								aria-hidden="true"
							>
								{monthLabels.map((label, week) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: colunas fixas da grade
									<span key={week} className="whitespace-nowrap">
										{label}
									</span>
								))}
							</div>
							<div
								className="grid grid-flow-col grid-rows-7 gap-[3px]"
								style={{ gridTemplateColumns: columns }}
							>
								{cells.map(({ date, inRange }) => {
									const key = dayKey(date)
									if (!inRange) return <span key={key} className="size-4" aria-hidden="true" />
									const day = byDate.get(key)
									const dateLabel = format(date, 'dd/MM/yyyy', { in: utc })
									const text = day
										? `${dateLabel}: ${formatCurrency(day.total)} em ${day.count} ${day.count === 1 ? 'transação' : 'transações'}`
										: `${dateLabel}: sem gastos`
									return (
										<span
											key={key}
											role="img"
											aria-label={text}
											title={text}
											className={cn('size-4 rounded-[3px]', !day && 'bg-muted')}
											style={
												day
													? { backgroundColor: levelColor(LEVEL_MIX[level(day.total)]) }
													: undefined
											}
										/>
									)
								})}
							</div>
						</div>
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="text-sm">
						Dia de maior gasto:{' '}
						<span className="font-medium tabular-nums">
							{format(parseDay(peak.date), 'dd/MM', { in: utc })}, {formatCurrency(peak.total)}
						</span>
					</p>
					<div
						className="flex items-center gap-1.5 text-xs text-muted-foreground"
						aria-hidden="true"
					>
						menos
						<span className="size-3 rounded-[3px] bg-muted" />
						{LEVEL_MIX.map((mix) => (
							<span
								key={mix}
								className="size-3 rounded-[3px]"
								style={{ backgroundColor: levelColor(mix) }}
							/>
						))}
						mais
					</div>
				</div>
			</div>
		)
	}

	return (
		<Card className={cn('min-w-0', isStale && 'opacity-60')}>
			<CardHeader>
				<CardTitle className="text-base">Calendário de gastos</CardTitle>
				<CardDescription>
					Em quais dias você gasta mais: quanto mais forte a cor, maior o gasto do dia. O valor de
					cada dia aparece ao passar o mouse.
				</CardDescription>
			</CardHeader>
			<CardContent>{content}</CardContent>
		</Card>
	)
}
