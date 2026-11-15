'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
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

// Mesmo código de cor do resto do app: entrada em --positive, saída em --negative
const chartConfig = {
	income: { label: 'Entradas', color: 'var(--positive)' },
	expense: { label: 'Saídas', color: 'var(--negative)' },
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

	// Setas para trocar de período pelo teclado; sem seleção, parte do último
	const selectedIndex = data.findIndex((item) => item.start === selectedStart)
	const current = selectedIndex >= 0 ? selectedIndex : data.length - 1
	const selectedItem = data[current]
	const unit = granularity === 'month' ? 'mês' : 'semana'

	// Texto para leitor de tela no lugar das colunas
	const summary = selectedItem
		? `Gráfico de entradas e saídas por ${unit}, ${data.length} períodos. ${selectedItem.longLabel}: entradas ${formatCurrency(selectedItem.income)}, saídas ${formatCurrency(selectedItem.expense)}.`
		: `Gráfico de entradas e saídas por ${unit}, sem dados.`

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Entradas e saídas</CardTitle>
				<CardDescription>
					{description ?? `Por ${unit}. Clique numa coluna ou use as setas para ver o período.`}
				</CardDescription>
				{data.length > 1 && (
					<CardAction className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={`${unit === 'mês' ? 'Mês' : 'Semana'} anterior`}
							disabled={current <= 0}
							onClick={() => onSelect(data[current - 1].start)}
						>
							<ChevronLeftIcon />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={`${unit === 'mês' ? 'Próximo mês' : 'Próxima semana'}`}
							disabled={current >= data.length - 1}
							onClick={() => onSelect(data[current + 1].start)}
						>
							<ChevronRightIcon />
						</Button>
					</CardAction>
				)}
			</CardHeader>
			<CardContent>
				<p className="sr-only" aria-live="polite">
					{summary}
				</p>
				<ChartContainer config={chartConfig} className="aspect-auto h-72 w-full" aria-hidden="true">
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
