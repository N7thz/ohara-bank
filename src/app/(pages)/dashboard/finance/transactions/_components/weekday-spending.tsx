'use client'

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart'
import type { DailySpending } from '@/hooks/finance/transactions'
import { formatCompactCurrency, formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { parseDay, spendingRange, weekdayIndex } from './spending-heatmap'

const DAY_MS = 86_400_000
const WEEKDAYS = [
	{ short: 'Seg', long: 'segundas' },
	{ short: 'Ter', long: 'terças' },
	{ short: 'Qua', long: 'quartas' },
	{ short: 'Qui', long: 'quintas' },
	{ short: 'Sex', long: 'sextas' },
	{ short: 'Sáb', long: 'sábados' },
	{ short: 'Dom', long: 'domingos' },
]

const chartConfig = {
	average: { label: 'Média por dia', color: 'var(--chart-1)' },
} satisfies ChartConfig

interface WeekdaySpendingProps {
	days: DailySpending[]
	/** AAAA-MM quando há mês filtrado */
	month: string | null
	isStale?: boolean
}

export function WeekdaySpending({ days, month, isStale }: WeekdaySpendingProps) {
	const range = spendingRange(days, month)

	let content: React.ReactNode
	if (!range || days.length === 0) {
		content = <p className="text-sm text-muted-foreground">Nenhuma saída no período.</p>
	} else {
		const rows = WEEKDAYS.map((weekday) => ({ ...weekday, total: 0, count: 0, occurrences: 0 }))
		// Dias sem gasto entram na conta: a média é por dia, não por dia com compra
		for (let time = range.start.getTime(); time <= range.end.getTime(); time += DAY_MS) {
			rows[weekdayIndex(new Date(time))].occurrences++
		}
		for (const day of days) {
			const row = rows[weekdayIndex(parseDay(day.date))]
			row.total += day.total
			row.count += day.count
		}
		const data = rows.map((row) => ({
			...row,
			average: row.occurrences > 0 ? row.total / row.occurrences : 0,
		}))
		const top = data.reduce((best, row) => (row.average > best.average ? row : best), data[0])
		const weekend = data.slice(5)
		const weekendAverage = weekend.reduce((sum, row) => sum + row.average, 0) / 2
		const weekdayAverage = data.slice(0, 5).reduce((sum, row) => sum + row.average, 0) / 5

		const summary = `Você gasta mais ${['Sáb', 'Dom'].includes(top.short) ? 'aos' : 'às'} ${top.long}: média de ${formatCurrency(top.average)} por dia.`

		content = (
			<div className="flex flex-col gap-3">
				<p className="text-sm">{summary}</p>
				<ChartContainer config={chartConfig} className="aspect-auto h-56 w-full" aria-hidden="true">
					<BarChart data={data} margin={{ left: 4, right: 4 }}>
						<CartesianGrid vertical={false} />
						<XAxis dataKey="short" tickLine={false} axisLine={false} tickMargin={8} />
						<YAxis
							tickLine={false}
							axisLine={false}
							width={72}
							tickFormatter={(value: number) => formatCompactCurrency(value)}
						/>
						<ChartTooltip
							cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
							content={
								<ChartTooltipContent
									hideIndicator
									labelFormatter={(_, payload) => payload?.[0]?.payload?.long}
									formatter={(_, __, item) => {
										const row = item.payload as (typeof data)[number]
										return (
											<div className="flex w-full flex-col gap-1">
												{[
													['Média por dia', formatCurrency(row.average)],
													['Total', formatCurrency(row.total)],
													['Transações', String(row.count)],
												].map(([label, value]) => (
													<div key={label} className="flex items-center justify-between gap-4">
														<span className="text-muted-foreground">{label}</span>
														<span className="font-medium text-foreground tabular-nums">
															{value}
														</span>
													</div>
												))}
											</div>
										)
									}}
								/>
							}
						/>
						<Bar
							dataKey="average"
							fill="var(--color-average)"
							radius={[4, 4, 0, 0]}
							maxBarSize={40}
						>
							{/* A mais alta em cor cheia; as outras apagadas */}
							{data.map((row) => (
								<Cell key={row.short} fillOpacity={row === top ? 1 : 0.4} />
							))}
						</Bar>
					</BarChart>
				</ChartContainer>
				<p className="text-xs text-muted-foreground">
					Fim de semana: média de{' '}
					<span className="tabular-nums">{formatCurrency(weekendAverage)}</span> por dia, contra{' '}
					<span className="tabular-nums">{formatCurrency(weekdayAverage)}</span> de segunda a sexta.
				</p>
			</div>
		)
	}

	return (
		<Card className={cn('min-w-0', isStale && 'opacity-60')}>
			<CardHeader>
				<CardTitle className="text-base">Gasto por dia da semana</CardTitle>
				<CardDescription>
					Média por dia: o total de cada dia da semana dividido por quantas vezes ele ocorreu no
					período, contando os dias sem gasto.
				</CardDescription>
			</CardHeader>
			<CardContent>{content}</CardContent>
		</Card>
	)
}
