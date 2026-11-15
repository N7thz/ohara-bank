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
import type { Payslip } from '@/hooks/finance/payslips'
import { formatCompactCurrency, formatCompetence, formatCurrency } from '@/lib/format'

// Líquido em destaque; descontos em neutro, mais apagados
const chartConfig = {
	net: { label: 'Líquido', color: 'var(--chart-1)' },
	deductions: { label: 'Descontos', color: 'var(--chart-5)' },
} satisfies ChartConfig

interface Row {
	competence: string
	label: string
	gross: number
	deductions: number
	net: number
	employers: number
}

export function PayslipChart({ payslips }: { payslips: Payslip[] }) {
	// Soma os holerites da mesma competência (mais de um empregador)
	const byCompetence = new Map<string, Row>()
	for (const payslip of payslips) {
		const row = byCompetence.get(payslip.competence) ?? {
			competence: payslip.competence,
			label: formatCompetence(payslip.competence),
			gross: 0,
			deductions: 0,
			net: 0,
			employers: 0,
		}
		row.gross += payslip.grossAmount
		row.deductions += payslip.deductionsAmount
		row.net += payslip.netAmount
		row.employers += 1
		byCompetence.set(payslip.competence, row)
	}
	const data = [...byCompetence.values()].sort((a, b) => a.competence.localeCompare(b.competence))

	if (payslips.length < 2 || data.length === 0) return null

	const first = data[0]
	const last = data[data.length - 1]
	const summary = `Evolução do holerite de ${first.label} a ${last.label}: líquido de ${formatCurrency(first.net)} para ${formatCurrency(last.net)}.`

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Evolução do holerite</CardTitle>
				<CardDescription>
					Por competência: o líquido mais os descontos formam o bruto.
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
									hideIndicator
									labelFormatter={(_, payload) => {
										const row = payload?.[0]?.payload as Row | undefined
										if (!row) return null
										return row.employers > 1
											? `${row.label} (soma de ${row.employers} holerites)`
											: row.label
									}}
									formatter={(_value, _name, item) => {
										// Uma linha só, com os valores da competência
										if (item.dataKey !== 'net') return null
										const row = item.payload as Row
										const rate = row.gross > 0 ? (row.deductions / row.gross) * 100 : 0
										const lines: [string, string][] = [
											['Bruto', formatCurrency(row.gross)],
											['Descontos', formatCurrency(row.deductions)],
											['Líquido', formatCurrency(row.net)],
											[
												'% de desconto',
												`${rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
											],
										]
										return (
											<div className="flex w-full flex-col gap-1">
												{lines.map(([label, value]) => (
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
						<ChartLegend content={<ChartLegendContent />} />
						<Bar dataKey="net" stackId="gross" fill="var(--color-net)" maxBarSize={40} />
						<Bar
							dataKey="deductions"
							stackId="gross"
							fill="var(--color-deductions)"
							fillOpacity={0.55}
							radius={[4, 4, 0, 0]}
							maxBarSize={40}
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	)
}
