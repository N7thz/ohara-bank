'use client'

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart'
import type { SummaryGranularity, SummaryPeriod } from '@/hooks/finance/summary'
import {
	formatCompactCurrency,
	formatCurrency,
	formatPeriodLong,
	formatPeriodShort,
} from '@/lib/format'

// Paleta categórica (slots 1 e 2), validada para daltonismo nos dois temas
const chartConfig = {
	income: { label: 'Entradas', theme: { light: '#2a78d6', dark: '#3987e5' } },
	expense: { label: 'Saídas', theme: { light: '#eb6834', dark: '#d95926' } },
} satisfies ChartConfig

interface IncomeExpenseChartProps {
	granularity: SummaryGranularity
	periods: Pick<SummaryPeriod, 'start' | 'end' | 'income' | 'expense'>[]
	selectedStart: string | null
	onSelect: (start: string) => void
	/** Texto abaixo do título; o padrão explica o clique na coluna */
	description?: string
}

export function IncomeExpenseChart({
	granularity,
	periods,
	selectedStart,
	onSelect,
	description,
}: IncomeExpenseChartProps) {
	const data = periods.map((period) => ({
		start: period.start,
		label: formatPeriodShort(granularity, period),
		longLabel: formatPeriodLong(granularity, period),
		income: period.income,
		// Saída como magnitude: as duas séries crescem da mesma linha de base
		expense: Math.abs(period.expense),
	}))

	// Fora do período selecionado as colunas ficam mais apagadas
	const opacity = (start: string) => (selectedStart && start !== selectedStart ? 0.35 : 1)

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Entradas e saídas</CardTitle>
				<CardDescription>
					{description ??
						`Por ${granularity === 'month' ? 'mês' : 'semana'}. Clique numa coluna para ver o período.`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
					<BarChart
						data={data}
						barGap={2}
						margin={{ left: 4, right: 4 }}
						onClick={(state) => {
							const index = Number(state?.activeTooltipIndex)
							if (Number.isInteger(index) && data[index]) onSelect(data[index].start)
						}}
					>
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
									formatter={(value, name) => (
										<div className="flex w-full items-center justify-between gap-4">
											<span className="text-muted-foreground">
												{chartConfig[name as keyof typeof chartConfig]?.label}
											</span>
											<span className="font-medium text-foreground tabular-nums">
												{formatCurrency(Number(value))}
											</span>
										</div>
									)}
								/>
							}
						/>
						<ChartLegend content={<ChartLegendContent />} />
						{(['income', 'expense'] as const).map((key) => (
							<Bar
								key={key}
								dataKey={key}
								fill={`var(--color-${key})`}
								radius={[4, 4, 0, 0]}
								maxBarSize={24}
								className="cursor-pointer"
							>
								{data.map((item) => (
									<Cell key={item.start} fillOpacity={opacity(item.start)} />
								))}
							</Bar>
						))}
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	)
}
