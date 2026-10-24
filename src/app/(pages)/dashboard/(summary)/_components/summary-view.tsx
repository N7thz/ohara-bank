'use client'

import { ChartColumnIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { HeroMetric } from '@/components/finance/hero-metric'
import { IncomeExpenseChart } from '@/components/finance/income-expense-chart'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useBankAccounts } from '@/hooks/finance/accounts'
import type { SummaryGranularity, SummaryPeriod } from '@/hooks/finance/summary'
import { useFinanceSummary } from '@/hooks/finance/summary'
import { useTags } from '@/hooks/finance/tags'
import { formatCurrency, formatPeriodLong, previousPeriodLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PeriodSummaryTable } from './period-summary-table'
import { TagSpendingComparison } from './tag-spending-comparison'

const ALL = 'all'

interface DeltaProps {
	value: number
	previous: number | undefined
	previousLabel: string
	/** Se subir é bom (entradas, saldo) ou ruim (saídas) */
	upIsGood: boolean
}

// "▲ R$ 120,00 vs mês anterior", verde quando a mudança é boa
function Delta({ value, previous, previousLabel, upIsGood }: DeltaProps) {
	const delta = previous === undefined ? null : value - previous
	const isGood = delta !== null && delta > 0 === upIsGood

	return (
		<span
			className={cn(
				delta === null || delta === 0
					? 'text-muted-foreground'
					: isGood
						? 'text-green-600'
						: 'text-red-500',
			)}
		>
			{delta === null
				? `Sem dados da ${previousLabel}`
				: delta === 0
					? `Igual à ${previousLabel}`
					: `${delta > 0 ? '▲' : '▼'} ${formatCurrency(Math.abs(delta))} vs ${previousLabel}`}
		</span>
	)
}

export function SummaryView() {
	const [granularity, setGranularity] = useState<SummaryGranularity>('month')
	const [accountId, setAccountId] = useState(ALL)
	const [selectedStart, setSelectedStart] = useState<string | null>(null)

	const { data: accounts = [] } = useBankAccounts()
	const { data: tags = [] } = useTags()
	const { data, isLoading, isError, isPlaceholderData } = useFinanceSummary({
		granularity,
		...(accountId !== ALL && { accountId }),
	})

	const periods = data?.periods ?? []
	// Sem seleção, mostra o período mais recente que tem transações
	const fallback = [...periods].reverse().find((period) => period.count > 0) ?? periods.at(-1)
	const selectedIndex = periods.findIndex((period) => period.start === selectedStart)
	const selected: SummaryPeriod | undefined = selectedIndex >= 0 ? periods[selectedIndex] : fallback
	const previous = selected ? periods[periods.indexOf(selected) - 1] : undefined
	const previousLabel = previousPeriodLabel(granularity)

	const accountItems = [
		{ value: ALL, label: 'Todas as contas' },
		...accounts.map((account) => ({
			value: account.id,
			label: `${account.bankName} · ${account.number}`,
		})),
	]

	const balance = selected ? selected.income + selected.expense : undefined
	const previousBalance = previous && previous.income + previous.expense

	return (
		<div className="stagger page-stack">
			<PageHeader
				eyebrow={selected ? formatPeriodLong(granularity, selected) : undefined}
				title="Resumo"
				description="Entradas, saídas e gastos por tag, sem as transferências entre contas próprias."
				aside={
					(isLoading || selected) && (
						<HeroMetric
							label="Saldo do período"
							value={balance}
							className={
								balance === undefined ? '' : balance >= 0 ? 'text-green-600' : 'text-red-500'
							}
							hint={
								selected && (
									<Delta
										value={balance ?? 0}
										previous={previousBalance}
										previousLabel={previousLabel}
										upIsGood
									/>
								)
							}
							items={
								selected && [
									{
										label: 'Entradas',
										value: selected.income,
										hint: (
											<Delta
												value={selected.income}
												previous={previous?.income}
												previousLabel={previousLabel}
												upIsGood
											/>
										),
									},
									{
										label: 'Saídas',
										value: Math.abs(selected.expense),
										hint: (
											<Delta
												value={Math.abs(selected.expense)}
												previous={previous && Math.abs(previous.expense)}
												previousLabel={previousLabel}
												upIsGood={false}
											/>
										),
									},
								]
							}
							footnote={
								selected &&
								(selected.excludedIn > 0 || selected.excludedOut < 0) &&
								`Fora dos totais: ${formatCurrency(selected.excludedIn)} entraram e ${formatCurrency(Math.abs(selected.excludedOut))} saíram entre contas próprias.`
							}
						/>
					)
				}
			>
				{/* Filtros: valem para o hero e para todas as seções abaixo */}
				<div className="flex flex-wrap items-center gap-2">
					<ToggleGroup
						variant="outline"
						spacing={0}
						value={[granularity]}
						onValueChange={(values) => {
							if (!values[0]) return
							setGranularity(values[0] as SummaryGranularity)
							setSelectedStart(null)
						}}
					>
						<ToggleGroupItem value="week">Semanal</ToggleGroupItem>
						<ToggleGroupItem value="month">Mensal</ToggleGroupItem>
					</ToggleGroup>

					<Select
						items={accountItems}
						value={accountId}
						onValueChange={(value) => {
							setAccountId(value ?? ALL)
							setSelectedStart(null)
						}}
					>
						<SelectTrigger className="min-w-48" aria-label="Conta">
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
				</div>
				{isError && <p className="text-sm text-destructive">Erro ao carregar o resumo.</p>}
			</PageHeader>

			{isLoading && <Skeleton className="h-96" />}

			{data && periods.length === 0 && (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ChartColumnIcon />
						</EmptyMedia>
						<EmptyTitle>Nenhuma transação ainda</EmptyTitle>
						<EmptyDescription>Importe um extrato para ver o resumo.</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button render={<Link href="/dashboard/finance" />}>Ir para Finanças</Button>
					</EmptyContent>
				</Empty>
			)}

			{selected && (
				// Ao trocar o filtro, mantém o que está na tela, mais apagado, até os dados novos chegarem
				<div className={cn('section-stack', isPlaceholderData && 'opacity-60')}>
					<PageSection
						title="Evolução"
						description={`Por ${granularity === 'month' ? 'mês' : 'semana'}. Clique numa coluna ou numa linha da tabela para ver o período.`}
					>
						{/* Assimétrico: o gráfico ocupa mais espaço que a lista de tags */}
						<div className="grid gap-6 md:grid-cols-[3fr_2fr]">
							<IncomeExpenseChart
								granularity={granularity}
								periods={periods}
								selectedStart={selected.start}
								onSelect={setSelectedStart}
							/>
							<TagSpendingComparison
								granularity={granularity}
								period={selected}
								previous={previous}
								tags={tags}
							/>
						</div>
					</PageSection>

					<PageSection
						title={granularity === 'month' ? 'Mês a mês' : 'Semana a semana'}
						className="reveal"
					>
						<PeriodSummaryTable
							granularity={granularity}
							periods={periods}
							tags={tags}
							selectedStart={selected.start}
							onSelect={setSelectedStart}
						/>
					</PageSection>
				</div>
			)}
		</div>
	)
}
