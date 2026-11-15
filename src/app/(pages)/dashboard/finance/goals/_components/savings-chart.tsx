'use client'

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart'
import type { SummaryPeriod } from '@/hooks/finance/summary'
import {
	formatCompactCurrency,
	formatCurrency,
	formatPeriodLong,
	formatPeriodShort,
} from '@/lib/format'

const chartConfig = {
	savings: { label: 'Economia', color: 'var(--positive)' },
} satisfies ChartConfig

interface SavingsChartProps {
	periods: Pick<SummaryPeriod, 'start' | 'end' | 'income' | 'expense'>[]
}

/** Economia de cada mês (entradas − saídas): positiva em verde, negativa em vermelho */
export function SavingsChart({ periods }: SavingsChartProps) {
	const data = periods.map((period) => ({
		start: period.start,
		label: formatPeriodShort('month', period),
		longLabel: formatPeriodLong('month', period),
		savings: period.income + period.expense,
	}))

	const summary = `Gráfico da economia por mês, ${data.length} meses. ${data
		.map(
			(item) =>
				`${item.longLabel}: ${item.savings >= 0 ? 'sobrou' : 'faltou'} ${formatCurrency(Math.abs(item.savings))}`,
		)
		.join('; ')}.`

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Economia por mês</CardTitle>
				<CardDescription>
					Entradas menos saídas, sem as transferências entre suas contas.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="sr-only">{summary}</p>
				<ChartContainer config={chartConfig} className="aspect-auto h-72 w-full" aria-hidden="true">
					<BarChart data={data} margin={{ left: 4, right: 4 }}>
						<CartesianGrid vertical={false} />
						<XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
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
									indicator="line"
									labelFormatter={(_, payload) => payload?.[0]?.payload?.longLabel}
									formatter={(value) => (
										<div className="flex w-full items-center justify-between gap-4">
											<span className="text-muted-foreground">Economia</span>
											<span className="font-medium text-foreground tabular-nums">
												{Number(value) > 0 ? '+' : ''}
												{formatCurrency(Number(value))}
											</span>
										</div>
									)}
								/>
							}
						/>
						<Bar dataKey="savings" radius={4} maxBarSize={32}>
							{data.map((item) => (
								<Cell
									key={item.start}
									fill={item.savings >= 0 ? 'var(--positive)' : 'var(--negative)'}
								/>
							))}
						</Bar>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	)
}
