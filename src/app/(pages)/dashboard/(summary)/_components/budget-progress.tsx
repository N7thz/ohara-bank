'use client'

import { utc } from '@date-fns/utc'
import { differenceInCalendarDays } from 'date-fns'
import { TagDot } from '@/components/finance/tag-badge'
import { Card, CardContent } from '@/components/ui/card'
import type { SummaryPeriod } from '@/hooks/finance/summary'
import type { Tag } from '@/hooks/finance/tags'
import { localTodayKey } from '@/lib/dates'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { TagManagerSheet } from '../../finance/transactions/_components/tag-manager-sheet'

interface BudgetProgressProps {
	/** Período mensal */
	period: SummaryPeriod
	tags: Tag[]
}

// Dias do mês já passados (contando hoje) e total; fora do mês atual, o mês está completo
function monthProgress(period: SummaryPeriod) {
	const total = differenceInCalendarDays(period.end, period.start, { in: utc }) + 1
	const today = localTodayKey()
	if (today < period.start || today > period.end) return { elapsed: total, total, isCurrent: false }
	return {
		elapsed: differenceInCalendarDays(today, period.start, { in: utc }) + 1,
		total,
		isCurrent: true,
	}
}

export function BudgetProgress({ period, tags }: BudgetProgressProps) {
	const { elapsed, total, isCurrent } = monthProgress(period)
	const rows = tags
		.filter((tag) => tag.monthlyBudget !== null && !tag.excludeFromTotals)
		.map((tag) => {
			const budget = tag.monthlyBudget as number
			const spent = Math.abs(period.byTag[tag.id] ?? 0)
			// No mês atual, projeta o fim do mês pelo ritmo de gasto até hoje
			const projected = isCurrent ? (spent / elapsed) * total : spent
			return { tag, budget, spent, projected, ratio: spent / budget }
		})
		.sort((a, b) => b.ratio - a.ratio)

	if (rows.length === 0) {
		return (
			<div className="flex flex-wrap items-center gap-3">
				<p className="text-sm text-muted-foreground">Nenhuma tag com orçamento.</p>
				<TagManagerSheet triggerLabel="Definir orçamentos" />
			</div>
		)
	}

	// Onde a barra "deveria" estar hoje se o gasto fosse uniforme no mês
	const expectedRatio = elapsed / total

	return (
		<div className="grid gap-4 md:grid-cols-2">
			{rows.map(({ tag, budget, spent, projected, ratio }) => {
				const remaining = budget - spent
				const isOver = remaining < 0
				const willExceed = isCurrent && !isOver && projected > budget
				const perDay = isCurrent && !isOver ? remaining / (total - elapsed + 1) : null

				return (
					<Card key={tag.id}>
						<CardContent className="flex flex-col gap-3">
							<div className="flex items-center gap-2">
								<TagDot color={tag.color} />
								<span className="flex-1 truncate font-medium">{tag.name}</span>
								<span
									className={cn(
										'text-sm tabular-nums',
										isOver ? 'text-negative' : 'text-muted-foreground',
									)}
								>
									{Math.round(ratio * 100)}%
								</span>
							</div>

							<div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
								<span
									className={cn(
										'block h-full origin-left rounded-full transition-transform duration-700 ease-out',
										isOver ? 'bg-destructive' : willExceed ? 'bg-warning' : 'bg-primary',
									)}
									style={{ transform: `scaleX(${Math.min(ratio, 1)})` }}
								/>
								{isCurrent && (
									<span
										className="absolute inset-y-0 w-0.5 bg-foreground/40"
										style={{ left: `${expectedRatio * 100}%` }}
										title="Onde o gasto estaria hoje num ritmo uniforme"
									/>
								)}
							</div>

							<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
								<span className="tabular-nums">
									{formatCurrency(spent)}{' '}
									<span className="text-muted-foreground">de {formatCurrency(budget)}</span>
								</span>
								<span
									className={cn('tabular-nums', isOver ? 'text-negative' : 'text-muted-foreground')}
								>
									{isOver
										? `${formatCurrency(Math.abs(remaining))} acima`
										: `${formatCurrency(remaining)} livres`}
								</span>
							</div>

							{isCurrent && (
								<p
									className={cn(
										'text-xs',
										isOver || willExceed ? 'text-negative' : 'text-muted-foreground',
									)}
								>
									{isOver
										? 'Orçamento estourado neste mês.'
										: willExceed
											? `No ritmo atual, fecha o mês em ${formatCurrency(projected)}.`
											: `Dá para gastar ${formatCurrency(perDay ?? 0)} por dia até o fim do mês.`}
								</p>
							)}
						</CardContent>
					</Card>
				)
			})}
		</div>
	)
}
