'use client'

import { ChartColumnIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { HeroMetric } from '@/components/finance/hero-metric'
import { IncomeExpenseChart } from '@/components/finance/income-expense-chart'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { QueryError } from '@/components/query-error'
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
import { useDailySpending, useFinanceSummary, useTopMerchants } from '@/hooks/finance/summary'
import { useTags } from '@/hooks/finance/tags'
import { formatCurrency, formatPeriodLong, previousPeriodLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { TagManagerSheet } from '../../finance/transactions/_components/tag-manager-sheet'
import { BudgetProgress } from './budget-progress'
import { PeriodSummaryTable } from './period-summary-table'
import { SpendingPaceChart } from './spending-pace-chart'
import { TagDonutChart } from './tag-donut-chart'
import { TagSpendingComparison } from './tag-spending-comparison'
import { TagStackChart } from './tag-stack-chart'
import { TopMerchants } from './top-merchants'

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
						? 'text-positive'
						: 'text-negative',
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
	const { data, isLoading, isError, isPlaceholderData, refetch, isRefetching } = useFinanceSummary({
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

	const { data: merchants } = useTopMerchants(
		selected && {
			start: selected.start,
			end: selected.end,
			...(previous && { previousStart: previous.start }),
			...(accountId !== ALL && { accountId }),
		},
	)

	const { data: daily, isLoading: dailyLoading } = useDailySpending(
		selected && {
			start: selected.start,
			end: selected.end,
			...(previous && { previousStart: previous.start }),
			...(accountId !== ALL && { accountId }),
		},
	)

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
								balance === undefined ? '' : balance >= 0 ? 'text-positive' : 'text-negative'
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
						// O período escolhido continua: os períodos são os mesmos em qualquer conta
						onValueChange={(value) => setAccountId(value ?? ALL)}
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
				{isError && (
					<QueryError
						message="Não foi possível carregar o resumo."
						onRetry={() => refetch()}
						retrying={isRefetching}
					/>
				)}
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
						<Button nativeButton={false} render={<Link href="/dashboard/finance" />}>
							Ir para Contas
						</Button>
					</EmptyContent>
				</Empty>
			)}

			{selected && (
				// Ao trocar o filtro, mantém o que está na tela, mais apagado, até os dados novos chegarem
				<div className={cn('section-stack', isPlaceholderData && 'opacity-60')}>
					<PageSection
						title="Evolução"
						description="Escolha um período no gráfico ou na tabela Mês a mês; a página inteira passa a mostrar ele."
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
						title="Ritmo de gastos"
						description={`Quanto você já gastou a cada dia de ${formatPeriodLong(granularity, selected)}, contra o ${previousLabel}.`}
					>
						<SpendingPaceChart
							granularity={granularity}
							start={selected.start}
							end={selected.end}
							previousStart={previous?.start}
							data={daily}
							isLoading={dailyLoading}
						/>
					</PageSection>

					<PageSection
						title="Gastos por tag"
						description="Quais categorias crescem ao longo dos períodos e qual a fatia de cada uma no período escolhido."
					>
						{/* Assimétrico como a Evolução; uma coluna no celular */}
						<div className="grid gap-6 md:grid-cols-[3fr_2fr]">
							<TagStackChart
								granularity={granularity}
								periods={periods}
								tags={tags}
								selectedStart={selected.start}
								onSelect={setSelectedStart}
							/>
							<TagDonutChart granularity={granularity} period={selected} tags={tags} />
						</div>
					</PageSection>

					{granularity === 'month' && (
						<PageSection
							title="Orçamentos"
							actions={
								tags.some((tag) => tag.monthlyBudget !== null && !tag.excludeFromTotals) && (
									<TagManagerSheet
										triggerLabel="Editar orçamentos"
										triggerVariant="ghost"
										triggerSize="sm"
									/>
								)
							}
							description="Gasto do mês nas tags com limite. A marca na barra é onde o gasto deveria estar hoje."
						>
							<BudgetProgress period={selected} tags={tags} />
						</PageSection>
					)}

					<PageSection
						title="Para onde foi o dinheiro"
						description={`Onde você mais gastou em ${formatPeriodLong(granularity, selected)}.`}
					>
						<TopMerchants
							granularity={granularity}
							periodStart={selected.start}
							accountId={accountId === ALL ? undefined : accountId}
							data={merchants}
							tags={tags}
						/>
					</PageSection>

					<PageSection title={granularity === 'month' ? 'Mês a mês' : 'Semana a semana'}>
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
