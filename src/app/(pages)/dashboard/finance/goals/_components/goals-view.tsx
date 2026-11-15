'use client'

import { PiggyBankIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { HeroMetric } from '@/components/finance/hero-metric'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
	type Goal,
	type GoalContribution,
	useDeleteContribution,
	useDeleteGoal,
	useGoals,
} from '@/hooks/finance/goals'
import { useFinanceSummary } from '@/hooks/finance/summary'
import { localMonthKey } from '@/lib/dates'
import { formatCurrency, formatDate } from '@/lib/format'
import { averageSavings as computeAverage, savingsRate } from '@/lib/goals'
import { ContributionDialog, type ContributionTarget } from './contribution-dialog'
import { GoalCard } from './goal-card'
import { GoalFormDialog, type GoalFormInitial } from './goal-form-dialog'
import { SavingsChart } from './savings-chart'

export function GoalsView() {
	const goalsQuery = useGoals()
	const summaryQuery = useFinanceSummary({ granularity: 'month' })
	const { mutateAsync: deleteGoal } = useDeleteGoal()
	const { mutateAsync: deleteContribution } = useDeleteContribution()

	const [form, setForm] = useState<GoalFormInitial>(null)
	const [contribution, setContribution] = useState<ContributionTarget | null>(null)
	const [removing, setRemoving] = useState<Goal | null>(null)
	const [removingContribution, setRemovingContribution] = useState<{
		goal: Goal
		item: GoalContribution
	} | null>(null)

	const goals = goalsQuery.data ?? []
	const periods = summaryQuery.data?.periods ?? []
	const currentMonth = localMonthKey()
	const average = summaryQuery.data ? computeAverage(periods, currentMonth) : null
	const rate = summaryQuery.data ? savingsRate(periods, currentMonth) : null
	const totalSaved = goalsQuery.data ? goals.reduce((sum, goal) => sum + goal.saved, 0) : undefined

	const isError = goalsQuery.isError || summaryQuery.isError

	return (
		<div className="stagger page-stack">
			<PageHeader
				eyebrow="Metas"
				title="Metas e economias"
				description="Quanto você quer juntar, quanto já guardou e quanto sobra por mês depois das contas. A economia vem dos extratos, sem as transferências entre suas contas."
				aside={
					<HeroMetric
						label="Guardado nas metas"
						value={totalSaved}
						className="text-positive"
						items={
							summaryQuery.data
								? [
										{
											label: 'Economia média/mês',
											value: average ?? 0,
											className:
												average === null
													? undefined
													: average >= 0
														? 'text-positive'
														: 'text-negative',
											hint:
												average === null
													? 'Sem meses completos ainda'
													: 'Últimos 3 meses completos',
										},
									]
								: undefined
						}
						footnote={
							rate === null
								? undefined
								: `Taxa de poupança: ${(rate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das entradas`
						}
					/>
				}
			>
				{isError && (
					<QueryError
						message="Não foi possível carregar as metas e a economia."
						onRetry={() => {
							goalsQuery.refetch()
							summaryQuery.refetch()
						}}
						retrying={goalsQuery.isRefetching || summaryQuery.isRefetching}
					/>
				)}
			</PageHeader>

			<PageSection
				title="Metas"
				description="Guardar e retirar registram o que você separou; não mexem nas transações."
				actions={
					goals.length > 0 && (
						<Button onClick={() => setForm({})}>
							<PlusIcon />
							Nova meta
						</Button>
					)
				}
			>
				{goalsQuery.isLoading ? (
					<div className="grid gap-6 md:grid-cols-2">
						<Skeleton className="h-56" />
						<Skeleton className="h-56" />
					</div>
				) : goals.length > 0 ? (
					<div className="grid gap-6 md:grid-cols-2">
						{goals.map((goal) => (
							<GoalCard
								key={goal.id}
								goal={goal}
								averageSavings={average}
								onSave={() => setContribution({ goal, mode: 'save' })}
								onWithdraw={() => setContribution({ goal, mode: 'withdraw' })}
								onEdit={() => setForm(goal)}
								onRemove={() => setRemoving(goal)}
								onRemoveContribution={(item) => setRemovingContribution({ goal, item })}
							/>
						))}
					</div>
				) : (
					!goalsQuery.isError && (
						<Empty className="border">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<PiggyBankIcon />
								</EmptyMedia>
								<EmptyTitle>Nenhuma meta ainda</EmptyTitle>
								<EmptyDescription>
									Crie uma meta, como reserva de emergência ou viagem, e acompanhe quanto falta.
								</EmptyDescription>
							</EmptyHeader>
							<EmptyContent>
								<Button onClick={() => setForm({})}>
									<PlusIcon />
									Criar meta
								</Button>
							</EmptyContent>
						</Empty>
					)
				)}
			</PageSection>

			<PageSection
				title="Economia mês a mês"
				description="Entradas menos saídas de cada mês. O mês atual ainda está incompleto."
			>
				{summaryQuery.isLoading ? (
					<Skeleton className="h-96" />
				) : periods.length > 0 ? (
					<SavingsChart periods={periods} />
				) : (
					!summaryQuery.isError && (
						<Empty className="border">
							<EmptyHeader>
								<EmptyTitle>Sem extratos importados</EmptyTitle>
								<EmptyDescription>
									Importe um extrato para ver quanto sobra a cada mês.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)
				)}
			</PageSection>

			<GoalFormDialog initial={form} onClose={() => setForm(null)} />
			<ContributionDialog target={contribution} onClose={() => setContribution(null)} />

			<ConfirmDialog
				open={!!removing}
				onOpenChange={(open) => !open && setRemoving(null)}
				title={`Remover a meta ${removing?.name ?? ''}?`}
				description={
					<>
						A meta e todos os valores guardados e retirados nela (
						{removing && formatCurrency(removing.saved)} guardados) somem do app. As transações dos
						extratos não mudam. Não dá para desfazer.
					</>
				}
				confirmLabel="Remover meta"
				destructive
				errorMessage="Não foi possível remover a meta"
				onConfirm={async () => {
					if (removing) await deleteGoal(removing.id)
				}}
			/>

			<ConfirmDialog
				open={!!removingContribution}
				onOpenChange={(open) => !open && setRemovingContribution(null)}
				title="Remover este lançamento?"
				description={
					removingContribution && (
						<>
							O lançamento de {formatDate(removingContribution.item.date)} (
							{formatCurrency(Math.abs(removingContribution.item.amount))}) sai da meta{' '}
							{removingContribution.goal.name} e o guardado é recalculado. Não dá para desfazer.
						</>
					)
				}
				confirmLabel="Remover lançamento"
				destructive
				errorMessage="Não foi possível remover o lançamento"
				onConfirm={async () => {
					if (removingContribution) {
						await deleteContribution({
							goalId: removingContribution.goal.id,
							id: removingContribution.item.id,
						})
					}
				}}
			/>
		</div>
	)
}
