'use client'

import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts'

import { QueryError } from '@/components/query-error'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { type BankAccount, useBalanceHistory } from '@/hooks/finance/accounts'
import { formatCompactCurrency, formatCurrency, formatDate } from '@/lib/format'

const chartConfig = {
	balance: { label: 'Saldo', color: 'var(--chart-1)' },
} satisfies ChartConfig

const toTime = (date: string) => new Date(`${date}T00:00:00Z`).getTime()

// Eixo X em escala de tempo: dias sem movimento ocupam espaço, como no calendário
const formatTick = (time: number) => formatDate(new Date(time).toISOString())

interface BalanceHistoryChartProps {
	/** Só contas com saldo */
	accounts: BankAccount[]
}

export function BalanceHistoryChart({ accounts }: BalanceHistoryChartProps) {
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const accountId = accounts.find((account) => account.id === selectedId)?.id ?? accounts[0]?.id
	const {
		data: history,
		isLoading,
		isError,
		refetch,
		isRefetching,
	} = useBalanceHistory(accountId ?? null)

	const accountItems = accounts.map((account) => ({
		value: account.id,
		label: `${account.bankName} · ${account.number}`,
	}))

	const data = (history ?? []).map((point) => ({ ...point, time: toTime(point.date) }))
	const lowest = data.reduce((min, point) => (point.balance < min.balance ? point : min), data[0])
	const highest = data.reduce((max, point) => (point.balance > max.balance ? point : max), data[0])
	const hasNegative = !!lowest && lowest.balance < 0

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Saldo no fim de cada dia</CardTitle>
				<CardDescription>
					Saldo reconstruído a partir do último extrato; pode divergir se faltar algum extrato no
					meio.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{accounts.length > 1 && (
					<Select
						items={accountItems}
						value={accountId ?? null}
						onValueChange={(value) => setSelectedId(value)}
					>
						<SelectTrigger className="w-full sm:w-fit sm:min-w-56" aria-label="Conta do gráfico">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{accountItems.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				)}

				{isLoading && <Skeleton className="h-72" />}

				{isError && (
					<QueryError
						message="Não foi possível carregar o histórico de saldo."
						onRetry={() => refetch()}
						retrying={isRefetching}
					/>
				)}

				{history && data.length < 2 && (
					<p className="text-sm text-muted-foreground">
						Ainda não há movimento suficiente nesta conta para mostrar a evolução do saldo.
					</p>
				)}

				{data.length >= 2 && (
					<>
						<p className="text-sm">
							De {formatDate(data[0].date)} a {formatDate(data[data.length - 1].date)}: menor saldo{' '}
							<span className="font-medium tabular-nums">{formatCurrency(lowest.balance)}</span> em{' '}
							{formatDate(lowest.date)}; maior saldo{' '}
							<span className="font-medium tabular-nums">{formatCurrency(highest.balance)}</span> em{' '}
							{formatDate(highest.date)}.
						</p>
						<ChartContainer
							config={chartConfig}
							className="aspect-auto h-72 w-full"
							aria-hidden="true"
						>
							<AreaChart data={data} margin={{ left: 4, right: 12 }}>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="time"
									type="number"
									scale="time"
									domain={['dataMin', 'dataMax']}
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={48}
									tickFormatter={formatTick}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									width={72}
									tickFormatter={(value: number) => formatCompactCurrency(value)}
								/>
								{hasNegative && (
									<ReferenceLine y={0} stroke="var(--negative)" strokeDasharray="4 4" />
								)}
								<ChartTooltip
									content={
										<ChartTooltipContent
											indicator="line"
											labelFormatter={(_, payload) => {
												const date = payload?.[0]?.payload?.date
												return date ? formatDate(date) : null
											}}
											formatter={(value) => (
												<div className="flex w-full items-center justify-between gap-4">
													<span className="text-muted-foreground">Saldo</span>
													<span className="font-medium text-foreground tabular-nums">
														{formatCurrency(Number(value))}
													</span>
												</div>
											)}
										/>
									}
								/>
								<Area
									dataKey="balance"
									type="stepAfter"
									stroke="var(--color-balance)"
									strokeWidth={2}
									fill="var(--color-balance)"
									fillOpacity={0.15}
									isAnimationActive={false}
								/>
							</AreaChart>
						</ChartContainer>
					</>
				)}
			</CardContent>
		</Card>
	)
}
