'use client'

import { Cell, Pie, PieChart } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart'
import type { SummaryGranularity, SummaryPeriod } from '@/hooks/finance/summary'
import type { Tag } from '@/hooks/finance/tags'
import { formatCurrency, formatPeriodLong } from '@/lib/format'
import {
	hasTagOverlap,
	OTHERS_COLOR,
	othersSpend,
	tagChartColor,
	tagSpend,
	topTags,
	UNTAGGED_COLOR,
} from './tag-series'

interface TagDonutChartProps {
	granularity: SummaryGranularity
	period: SummaryPeriod
	tags: Tag[]
}

interface Slice {
	key: string
	name: string
	value: number
	color: string
}

export function TagDonutChart({ granularity, period, tags }: TagDonutChartProps) {
	const top = topTags([period], tags)
	const others = othersSpend(period, tags, top)
	const untagged = Math.abs(period.untagged)

	const slices: Slice[] = top.map((tag, index) => ({
		key: `s${index}`,
		name: tag.name,
		value: tagSpend(period, tag),
		color: tagChartColor(tag.color),
	}))
	if (others > 0) slices.push({ key: 'others', name: 'Outras', value: others, color: OTHERS_COLOR })
	if (untagged > 0) {
		slices.push({ key: 'none', name: 'Sem tag', value: untagged, color: UNTAGGED_COLOR })
	}

	// Percentual sobre a soma das fatias: uma transação com duas tags aparece em duas
	const sum = slices.reduce((total, slice) => total + slice.value, 0)
	const expense = Math.abs(period.expense)
	const percent = (value: number) =>
		`${((value / sum) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

	const chartConfig: ChartConfig = Object.fromEntries(
		slices.map((slice) => [slice.key, { label: slice.name, color: slice.color }]),
	)
	const periodLabel = formatPeriodLong(granularity, period)

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Fatia de cada tag</CardTitle>
				<CardDescription>Saídas de {periodLabel} por tag.</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{sum === 0 ? (
					<p className="text-sm text-muted-foreground">Nenhuma saída no período.</p>
				) : (
					<>
						<div className="relative mx-auto aspect-square w-full max-w-56">
							<ChartContainer
								config={chartConfig}
								className="aspect-square h-full w-full"
								aria-hidden="true"
							>
								<PieChart>
									<ChartTooltip
										content={
											<ChartTooltipContent
												hideLabel
												formatter={(value, _name, item) => (
													<>
														<span
															className="size-2.5 shrink-0 rounded-[2px]"
															style={{ background: item.payload?.color }}
														/>
														<div className="flex w-full items-center justify-between gap-4">
															<span className="text-muted-foreground">{item.payload?.name}</span>
															<span className="font-medium text-foreground tabular-nums">
																{formatCurrency(Number(value))}
															</span>
														</div>
													</>
												)}
											/>
										}
									/>
									<Pie
										data={slices}
										dataKey="value"
										nameKey="name"
										innerRadius="62%"
										outerRadius="100%"
										paddingAngle={slices.length > 1 ? 2 : 0}
										stroke="none"
									>
										{slices.map((slice) => (
											<Cell key={slice.key} fill={slice.color} />
										))}
									</Pie>
								</PieChart>
							</ChartContainer>
							{/* Total no centro; não captura o mouse para o tooltip da rosca funcionar */}
							<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
								<span className="text-xs text-muted-foreground">Saídas</span>
								<span className="text-lg font-semibold tabular-nums">
									{formatCurrency(expense)}
								</span>
							</div>
						</div>
						<ul className="flex flex-col gap-2">
							{slices.map((slice) => (
								<li key={slice.key} className="flex items-center gap-2 text-sm">
									<span
										className="size-2.5 shrink-0 rounded-full"
										style={{ background: slice.color }}
									/>
									<span className="min-w-0 flex-1 truncate">{slice.name}</span>
									<span className="tabular-nums">{formatCurrency(slice.value)}</span>
									<span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
										{percent(slice.value)}
									</span>
								</li>
							))}
						</ul>
						<p className="text-xs text-muted-foreground">
							{hasTagOverlap(period, tags)
								? 'Uma transação com duas tags conta nas duas; por isso a soma das fatias passa do total de saídas e o percentual é sobre a soma das fatias.'
								: 'O percentual é sobre a soma das fatias; uma transação com duas tags conta nas duas.'}
						</p>
					</>
				)}
			</CardContent>
		</Card>
	)
}
