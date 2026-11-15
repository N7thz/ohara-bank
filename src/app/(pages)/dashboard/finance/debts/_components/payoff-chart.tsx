'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart'
import type { Debt } from '@/hooks/finance/debts'
import { localMonthKey } from '@/lib/dates'
import {
	formatCompactCurrency,
	formatCurrency,
	formatPeriodLong,
	formatPeriodShort,
} from '@/lib/format'

const MAX_DEBTS = 5
const OTHERS = 'others'

// Cores sem significado de dinheiro; "Outras" em cinza do texto
const COLORS = [
	'var(--chart-1)',
	'var(--chart-2)',
	'var(--chart-3)',
	'var(--chart-4)',
	'var(--chart-5)',
]
const OTHERS_COLOR = 'var(--muted-foreground)'

// Mês como número (ano * 12 + mês) para somar e comparar sem datas
const monthIndex = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1
const monthStart = (index: number) =>
	`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`

const shortLabel = (index: number) =>
	formatPeriodShort('month', { start: monthStart(index), end: monthStart(index) })
const longLabel = (index: number) =>
	formatPeriodLong('month', { start: monthStart(index), end: monthStart(index) })

interface Loan {
	id: string
	name: string
	amount: number
	pending: number
	/** Mês da primeira parcela que falta */
	first: number
	/** Mês da última parcela */
	last: number
}

/** Parceladas em aberto: as parcelas que faltam caem uma por mês até o endMonth */
function openLoans(debts: Debt[]): Loan[] {
	const loans: Loan[] = []
	for (const debt of debts) {
		if (debt.kind !== 'INSTALLMENT' || !debt.installments || !debt.endMonth) continue
		const pending = debt.installments - (debt.paidInstallments ?? 0)
		if (pending <= 0 || debt.status === 'finished') continue
		const last = monthIndex(debt.endMonth)
		loans.push({
			id: debt.id,
			name: debt.name,
			amount: debt.amount,
			pending,
			first: last - pending + 1,
			last,
		})
	}
	return loans
}

/** Parcelas ainda por pagar depois de pagar a do mês `month` */
const pendingAfter = (loan: Loan, month: number) =>
	Math.max(0, Math.min(loan.pending, loan.last - month))

const monthlyPayment = (loans: Loan[], month: number) =>
	loans.reduce(
		(sum, loan) => sum + (month >= loan.first && month <= loan.last ? loan.amount : 0),
		0,
	)

export function PayoffChart({ debts }: { debts: Debt[] }) {
	const loans = openLoans(debts)
	if (loans.length === 0) return null

	const nowMonth = monthIndex(localMonthKey())
	const firstMonth = Math.min(nowMonth, ...loans.map((loan) => loan.first))
	const endMonth = Math.max(...loans.map((loan) => loan.last))

	// Maiores saldos ficam com nome e cor; o resto vira "Outras"
	const sorted = [...loans].sort((a, b) => b.amount * b.pending - a.amount * a.pending)
	const shown = sorted.slice(0, sorted.length > MAX_DEBTS ? MAX_DEBTS - 1 : MAX_DEBTS)
	const rest = sorted.slice(shown.length)
	const keyOf = (loan: Loan) => `d_${loan.id}`

	const series = shown.map((loan, index) => ({
		key: keyOf(loan),
		label: loan.name,
		color: COLORS[index],
		last: loan.last,
	}))
	if (rest.length > 0) {
		series.push({
			key: OTHERS,
			label: `Outras (${rest.length})`,
			color: OTHERS_COLOR,
			last: Math.max(...rest.map((loan) => loan.last)),
		})
	}

	const chartConfig: ChartConfig = Object.fromEntries(
		series.map((item) => [item.key, { label: item.label, color: item.color }]),
	)

	// Primeiro ponto: saldo de hoje, antes da parcela do mês; depois, o saldo no fim de cada mês
	const balanceOf = (loan: Loan, month: number | null) =>
		loan.amount * (month === null ? loan.pending : pendingAfter(loan, month))

	const rowFor = (month: number | null) => {
		const row: Record<string, number | string> = {
			label: month === null ? 'Hoje' : shortLabel(month),
			longLabel: month === null ? 'Hoje' : longLabel(month),
		}
		for (const loan of shown) row[keyOf(loan)] = balanceOf(loan, month)
		if (rest.length > 0) {
			row[OTHERS] = rest.reduce((sum, loan) => sum + balanceOf(loan, month), 0)
		}
		return row
	}

	const data = [rowFor(null)]
	for (let month = firstMonth; month <= endMonth; month++) data.push(rowFor(month))

	// Frase-resumo: quando quita e quando a parcela mensal cai
	const firstPayment = monthlyPayment(loans, firstMonth)
	const firstEnd = Math.min(...loans.map((loan) => loan.last))
	const afterPayment = monthlyPayment(loans, firstEnd + 1)
	const drops = endMonth > firstEnd && afterPayment > 0 && afterPayment < firstPayment
	const summary = `Sem novas parcelas, você quita tudo em ${longLabel(endMonth)}${
		drops
			? `; a parcela mensal cai de ${formatCurrency(firstPayment)} para ${formatCurrency(afterPayment)} em ${longLabel(firstEnd + 1)}`
			: ''
	}.`

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Saldo devedor das parceladas</CardTitle>
				<CardDescription>
					Quanto falta pagar no fim de cada mês, com uma parcela por mês em cada dívida.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<p className="text-sm">{summary}</p>
				<ChartContainer config={chartConfig} className="aspect-auto h-72 w-full" aria-hidden="true">
					<AreaChart data={data} margin={{ left: 4, right: 12 }}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="label"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={24}
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
									indicator="dot"
									labelFormatter={(_, payload) => payload?.[0]?.payload?.longLabel}
									formatter={(value, name, item, index, payload) => (
										<>
											<div
												className="size-2.5 shrink-0 rounded-[2px]"
												style={{ backgroundColor: item.color }}
											/>
											<div className="flex w-full items-center justify-between gap-4">
												<span className="text-muted-foreground">
													{chartConfig[String(name)]?.label}
												</span>
												<span className="font-medium text-foreground tabular-nums">
													{formatCurrency(Number(value))}
												</span>
											</div>
											{index === series.length - 1 && (
												<div className="mt-1 flex w-full basis-full items-center justify-between gap-4 border-t pt-1">
													<span className="text-muted-foreground">Total</span>
													<span className="font-medium text-foreground tabular-nums">
														{formatCurrency(
															(payload as unknown as { value?: number }[]).reduce(
																(sum, entry) => sum + Number(entry.value ?? 0),
																0,
															),
														)}
													</span>
												</div>
											)}
										</>
									)}
								/>
							}
						/>
						{[...series].reverse().map((item) => (
							<Area
								key={item.key}
								dataKey={item.key}
								type="monotone"
								stackId="balance"
								stroke={`var(--color-${item.key})`}
								fill={`var(--color-${item.key})`}
								fillOpacity={0.55}
								isAnimationActive={false}
							/>
						))}
					</AreaChart>
				</ChartContainer>
				<ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
					{series.map((item) => (
						<li key={item.key} className="flex items-center gap-1.5">
							<span
								className="size-2.5 shrink-0 rounded-[2px]"
								style={{ backgroundColor: item.color }}
								aria-hidden="true"
							/>
							<span>{item.label}</span>
							<span className="text-muted-foreground">termina em {shortLabel(item.last)}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	)
}
