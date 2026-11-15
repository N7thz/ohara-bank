'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart'
import type { DailySpending, SummaryGranularity } from '@/hooks/finance/summary'
import { localTodayKey } from '@/lib/dates'
import {
	formatCompactCurrency,
	formatCurrency,
	formatDate,
	previousPeriodLabel,
} from '@/lib/format'
import { cn } from '@/lib/utils'

const DAY_MS = 86_400_000

// Atual em destaque (--chart-1), anterior em neutro tracejado (--chart-5)
const chartConfig = {
	current: { label: 'Período atual', color: 'var(--chart-1)' },
	previous: { label: 'Período anterior', color: 'var(--chart-5)' },
} satisfies ChartConfig

const dayIndex = (from: string, date: string) =>
	Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

/** Gasto acumulado por dia (índice 0 = primeiro dia), com zero nos dias sem gasto */
function accumulate(from: string, days: number, entries: { date: string; total: number }[]) {
	const perDay = new Array<number>(days).fill(0)
	for (const { date, total } of entries) {
		const index = dayIndex(from, date)
		if (index >= 0 && index < days) perDay[index] += total
	}
	let sum = 0
	return perDay.map((value) => {
		sum += value
		return Math.round(sum * 100) / 100
	})
}

interface SpendingPaceChartProps {
	granularity: SummaryGranularity
	/** Período escolhido, AAAA-MM-DD inclusive */
	start: string
	end: string
	/** Começo do período anterior; undefined quando não há */
	previousStart: string | undefined
	data: DailySpending | undefined
	isLoading: boolean
}

export function SpendingPaceChart({
	granularity,
	start,
	end,
	previousStart,
	data,
	isLoading,
}: SpendingPaceChartProps) {
	const unit = granularity === 'month' ? 'mês' : 'semana'
	const previousLabel = previousPeriodLabel(granularity)
	const description = `Soma das saídas dia a dia no ${unit}, contra o ${previousLabel}.`

	if (!data) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Ritmo de gastos</CardTitle>
					<CardDescription>{description}</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						{isLoading ? 'Carregando…' : 'Não foi possível carregar os gastos por dia.'}
					</p>
				</CardContent>
			</Card>
		)
	}

	const days = dayIndex(start, end) + 1
	const today = localTodayKey()
	// O período atual para no último dia com extrato (ou hoje): depois disso não há dado, não gasto zero
	const cutoffDate = [end, today, data.lastStatementDate ?? end].reduce((a, b) => (a < b ? a : b))
	const cutoff = Math.min(days, Math.max(dayIndex(start, cutoffDate) + 1, 0))

	const currentTotals = accumulate(start, days, data.current)
	const previousDays = previousStart ? dayIndex(previousStart, start) : 0
	const previousTotals =
		data.previous && previousStart ? accumulate(previousStart, previousDays, data.previous) : null

	const chartDays = Math.max(days, previousDays)
	const rows = Array.from({ length: chartDays }, (_, index) => {
		const current = index < cutoff ? currentTotals[index] : null
		const previous = previousTotals && index < previousDays ? previousTotals[index] : null
		return {
			day: index + 1,
			date:
				index < days
					? formatDate(new Date(Date.parse(`${start}T00:00:00Z`) + index * DAY_MS).toISOString())
					: null,
			current,
			previous,
			diff: current !== null && previous !== null ? current - previous : null,
		}
	})

	const hasSpending = data.current.length > 0 || (data.previous?.length ?? 0) > 0
	const last = cutoff > 0 ? rows[cutoff - 1] : undefined

	// Frase-resumo: o acumulado de hoje contra o mesmo dia do período anterior
	let sentence: React.ReactNode = null
	if (last && last.current !== null) {
		const base = `Até o dia ${last.day}: ${formatCurrency(last.current)}`
		if (last.diff === null) {
			sentence = `${base}. Sem ${previousLabel} para comparar.`
		} else if (last.diff === 0) {
			sentence = `${base}, igual ao ${previousLabel} no mesmo dia.`
		} else {
			// Gastar mais é ruim: acima em vermelho, abaixo em verde
			sentence = (
				<>
					{base},{' '}
					<span className={cn('font-medium', last.diff > 0 ? 'text-negative' : 'text-positive')}>
						{last.diff > 0 ? '▲' : '▼'} {formatCurrency(Math.abs(last.diff))}{' '}
						{last.diff > 0 ? 'a mais' : 'a menos'}
					</span>{' '}
					que no {previousLabel} no mesmo dia.
				</>
			)
		}
	}

	const srSummary = hasSpending
		? `Gráfico do gasto acumulado por dia no ${unit}, contra o ${previousLabel}. ${last?.current != null ? `Até o dia ${last.day}: ${formatCurrency(last.current)}${last.previous != null ? `, ${previousLabel} no mesmo dia: ${formatCurrency(last.previous)}` : ''}.` : ''}`
		: ''

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Ritmo de gastos</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				{!hasSpending ? (
					<p className="text-sm text-muted-foreground">
						Nenhuma saída neste período nem no anterior.
					</p>
				) : (
					<>
						{sentence && <p className="text-sm">{sentence}</p>}
						<p className="sr-only">{srSummary}</p>
						<ChartContainer
							config={chartConfig}
							className="aspect-auto h-72 w-full"
							aria-hidden="true"
						>
							<LineChart data={rows} margin={{ left: 4, right: 12 }}>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="day"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									interval="preserveStartEnd"
									minTickGap={16}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									width={72}
									tickFormatter={(value: number) => formatCompactCurrency(value)}
								/>
								<ChartTooltip
									content={
										<ChartTooltipContent
											indicator="line"
											labelFormatter={(_, payload) => {
												const row = payload?.[0]?.payload
												return row ? `Dia ${row.day}${row.date ? ` (${row.date})` : ''}` : null
											}}
											formatter={(value, name, item) => (
												<div className="flex w-full flex-col gap-0.5">
													<div className="flex items-center justify-between gap-4">
														<span className="text-muted-foreground">
															{chartConfig[name as keyof typeof chartConfig]?.label}
														</span>
														<span className="font-medium text-foreground tabular-nums">
															{formatCurrency(Number(value))}
														</span>
													</div>
													{name === 'current' &&
														item.payload?.diff != null &&
														item.payload.diff !== 0 && (
															<span
																className={cn(
																	'text-right tabular-nums',
																	item.payload.diff > 0 ? 'text-negative' : 'text-positive',
																)}
															>
																{item.payload.diff > 0 ? '▲' : '▼'}{' '}
																{formatCurrency(Math.abs(item.payload.diff))}{' '}
																{item.payload.diff > 0 ? 'a mais' : 'a menos'}
															</span>
														)}
												</div>
											)}
										/>
									}
								/>
								<ChartLegend content={<ChartLegendContent />} />
								{previousTotals && (
									<Line
										dataKey="previous"
										type="monotone"
										stroke="var(--color-previous)"
										strokeWidth={2}
										strokeDasharray="5 4"
										dot={false}
										connectNulls={false}
									/>
								)}
								<Line
									dataKey="current"
									type="monotone"
									stroke="var(--color-current)"
									strokeWidth={2.5}
									dot={cutoff === 1}
									connectNulls={false}
								/>
							</LineChart>
						</ChartContainer>
					</>
				)}
			</CardContent>
		</Card>
	)
}
