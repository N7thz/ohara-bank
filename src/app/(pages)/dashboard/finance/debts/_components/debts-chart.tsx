'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart'
import type { DebtMonth } from '@/hooks/finance/debts'
import {
	formatCompactCurrency,
	formatCurrency,
	formatPeriodLong,
	formatPeriodShort,
} from '@/lib/format'

// Previsto em cinza (referência) e pago na cor de destaque
const chartConfig = {
	expected: { label: 'Previsto', theme: { light: '#b8b8b8', dark: '#5c5c5c' } },
	paid: { label: 'Pago', theme: { light: '#2a78d6', dark: '#3987e5' } },
} satisfies ChartConfig

export function DebtsChart({ months }: { months: DebtMonth[] }) {
	const data = months.map((month) => ({
		label: formatPeriodShort('month', month),
		longLabel: formatPeriodLong('month', month),
		expected: month.expected,
		paid: month.paid,
	}))

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Previsto e pago por mês</CardTitle>
				<CardDescription>
					Últimos 6 meses e os próximos 6. Nos meses futuros, só o previsto.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
					<BarChart data={data} barGap={2} margin={{ left: 4, right: 4 }}>
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
						{(['expected', 'paid'] as const).map((key) => (
							<Bar
								key={key}
								dataKey={key}
								fill={`var(--color-${key})`}
								radius={[4, 4, 0, 0]}
								maxBarSize={24}
							/>
						))}
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	)
}
