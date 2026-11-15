'use client'

import { utc } from '@date-fns/utc'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MinusIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { Goal, GoalContribution } from '@/hooks/finance/goals'
import { formatCurrency, formatDate } from '@/lib/format'
import { monthsToReach } from '@/lib/goals'

const monthLabel = (key: string) => format(`${key}-01`, "MMMM 'de' yyyy", { in: utc, locale: ptBR })

interface GoalCardProps {
	goal: Goal
	/** Economia média por mês; null sem meses completos */
	averageSavings: number | null
	onSave: () => void
	onWithdraw: () => void
	onEdit: () => void
	onRemove: () => void
	onRemoveContribution: (contribution: GoalContribution) => void
}

/** Linha de prazo: quanto guardar por mês, ou em quanto tempo fica pronta no ritmo atual */
function Pace({ goal, averageSavings }: Pick<GoalCardProps, 'goal' | 'averageSavings'>) {
	if (goal.remaining <= 0) {
		return <p className="text-sm font-medium text-positive">Meta atingida</p>
	}

	if (goal.targetMonth && goal.monthlyNeeded !== null) {
		return (
			<p className="text-sm">
				Faltam{' '}
				<span className="font-medium tabular-nums">{formatCurrency(goal.monthlyNeeded)}</span>
				/mês para chegar em {monthLabel(goal.targetMonth)}
			</p>
		)
	}

	const months =
		averageSavings === null ? null : monthsToReach({ remaining: goal.remaining, averageSavings })
	if (months === null) {
		return (
			<p className="text-sm text-muted-foreground">
				Sem economia média positiva para prever quando fica pronta.
			</p>
		)
	}
	return (
		<p className="text-sm">
			No seu ritmo atual, fica pronta em {months} {months === 1 ? 'mês' : 'meses'}
		</p>
	)
}

export function GoalCard({
	goal,
	averageSavings,
	onSave,
	onWithdraw,
	onEdit,
	onRemove,
	onRemoveContribution,
}: GoalCardProps) {
	const percent = Math.round(goal.ratio * 100)

	return (
		<Card>
			<CardContent className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<h3 className="truncate text-lg font-semibold" title={goal.name}>
						{goal.name}
					</h3>
					<p className="text-sm text-muted-foreground tabular-nums">
						<span className="font-medium text-foreground">{formatCurrency(goal.saved)}</span> de{' '}
						{formatCurrency(goal.targetAmount)} · {percent}%
					</p>
					{goal.targetMonth && (
						<p className="text-xs text-muted-foreground">Prazo: {monthLabel(goal.targetMonth)}</p>
					)}
				</div>

				<Progress
					value={percent}
					aria-label={`Progresso da meta ${goal.name}: ${percent}%`}
					className="gap-0"
				/>

				<Pace goal={goal} averageSavings={averageSavings} />

				<div className="flex flex-wrap gap-2">
					<Button size="sm" onClick={onSave}>
						<PlusIcon />
						Guardar
					</Button>
					<Button size="sm" variant="outline" onClick={onWithdraw} disabled={goal.saved <= 0}>
						<MinusIcon />
						Retirar
					</Button>
					<Button size="sm" variant="ghost" onClick={onEdit}>
						<PencilIcon />
						Editar
					</Button>
					<Button size="sm" variant="ghost" onClick={onRemove}>
						<Trash2Icon />
						Remover
					</Button>
				</div>

				{goal.contributions.length > 0 && (
					<ul className="flex flex-col divide-y border-t text-sm">
						{goal.contributions.slice(0, 3).map((item) => (
							<li key={item.id} className="flex items-center gap-2 py-2">
								<span className="shrink-0 text-muted-foreground tabular-nums">
									{formatDate(item.date)}
								</span>
								<span
									className="min-w-0 flex-1 truncate text-muted-foreground"
									title={item.note ?? ''}
								>
									{item.note ?? (item.amount > 0 ? 'Guardado' : 'Retirada')}
								</span>
								<span
									className={`shrink-0 font-medium tabular-nums ${item.amount > 0 ? 'text-positive' : 'text-negative'}`}
								>
									{item.amount > 0 ? '+' : '−'}
									{formatCurrency(Math.abs(item.amount))}
								</span>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={`Remover o lançamento de ${formatDate(item.date)}`}
									onClick={() => onRemoveContribution(item)}
								>
									<Trash2Icon />
								</Button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	)
}
