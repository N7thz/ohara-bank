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
import type { Tag } from '@/hooks/finance/tags'
import {
	formatCompactCurrency,
	formatCurrency,
	formatPeriodLong,
	formatPeriodShort,
} from '@/lib/format'
import {
	hasTagOverlap,
	OTHERS_COLOR,
	othersSpend,
	tagChartColor,
	tagSpend,
	topTags,
	UNTAGGED_COLOR,
} from './tag-series'

interface TagStackChartProps {
	granularity: SummaryGranularity
	periods: SummaryPeriod[]
	tags: Tag[]
	selectedStart: string | null
	onSelect: (start: string) => void
}

export function TagStackChart({
	granularity,
	periods,
	tags,
	selectedStart,
	onSelect,
}: TagStackChartProps) {
	const top = topTags(periods, tags)
	const hasOthers = periods.some((period) => othersSpend(period, tags, top) > 0)
	const hasUntagged = periods.some((period) => period.untagged < 0)

	// Chaves curtas (s0..s5): o id da tag não vira nome de variável CSS
	const chartConfig: ChartConfig = {}
	for (const [index, tag] of top.entries()) {
		chartConfig[`s${index}`] = { label: tag.name, color: tagChartColor(tag.color) }
	}
	if (hasOthers) chartConfig.others = { label: 'Outras', color: OTHERS_COLOR }
	if (hasUntagged) chartConfig.none = { label: 'Sem tag', color: UNTAGGED_COLOR }
	const keys = Object.keys(chartConfig)

	// Zero vira null: o tooltip só lista as tags que gastaram no período
	const orNull = (value: number) => (value > 0 ? value : null)
	const data = periods.map((period) => ({
		start: period.start,
		label: formatPeriodShort(granularity, period),
		longLabel: formatPeriodLong(granularity, period),
		...Object.fromEntries(top.map((tag, index) => [`s${index}`, orNull(tagSpend(period, tag))])),
		others: orNull(othersSpend(period, tags, top)),
		none: orNull(Math.abs(period.untagged)),
	})) as ({ start: string; label: string; longLabel: string } & Record<
		string,
		number | string | null
	>)[]

	const opacity = (start: string) => (selectedStart && start !== selectedStart ? 0.35 : 1)
	const overlap = periods.some((period) => hasTagOverlap(period, tags))
	const unit = granularity === 'month' ? 'mês' : 'semana'

	// Texto para leitor de tela no lugar das colunas
	const current = data.find((item) => item.start === selectedStart) ?? data.at(-1)
	const parts = current
		? keys
				.filter((key) => typeof current[key] === 'number')
				.map((key) => `${chartConfig[key].label} ${formatCurrency(Number(current[key]))}`)
		: []
	const summary = current
		? `Gráfico de gastos por tag por ${unit}, ${data.length} períodos. ${current.longLabel}: ${parts.join(', ') || 'sem saídas'}.`
		: `Gráfico de gastos por tag por ${unit}, sem dados.`

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Gastos por tag ao longo do tempo</CardTitle>
				<CardDescription>
					As tags que mais gastaram, por {unit}. Clique numa coluna para ver o período.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				{keys.length === 0 ? (
					<p className="text-sm text-muted-foreground">Nenhuma saída nos períodos.</p>
				) : (
					<>
						<p className="sr-only" aria-live="polite">
							{summary}
						</p>
						<ChartContainer
							config={chartConfig}
							className="aspect-auto h-72 w-full"
							aria-hidden="true"
						>
							<BarChart
								data={data}
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
											indicator="dot"
											labelFormatter={(_, payload) => payload?.[0]?.payload?.longLabel}
											formatter={(value, name, item) => (
												<>
													<span
														className="size-2.5 shrink-0 rounded-[2px]"
														style={{ background: item.color }}
													/>
													<div className="flex w-full items-center justify-between gap-4">
														<span className="text-muted-foreground">
															{chartConfig[name as string]?.label}
														</span>
														<span className="font-medium text-foreground tabular-nums">
															{formatCurrency(Number(value))}
														</span>
													</div>
												</>
											)}
										/>
									}
								/>
								<ChartLegend content={<ChartLegendContent />} />
								{keys.map((key) => (
									<Bar
										key={key}
										dataKey={key}
										stackId="tags"
										fill={`var(--color-${key})`}
										maxBarSize={36}
										className="cursor-pointer"
									>
										{data.map((item) => (
											<Cell key={item.start} fillOpacity={opacity(item.start)} />
										))}
									</Bar>
								))}
							</BarChart>
						</ChartContainer>
						{overlap && (
							<p className="text-xs text-muted-foreground">
								Uma transação com duas tags conta nas duas, então a altura da coluna pode passar do
								total de saídas do {unit}.
							</p>
						)}
					</>
				)}
			</CardContent>
		</Card>
	)
}
