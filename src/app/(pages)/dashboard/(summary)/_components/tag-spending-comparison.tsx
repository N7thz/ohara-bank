'use client'

import { TagDot } from '@/components/finance/tag-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SummaryGranularity, SummaryPeriod } from '@/hooks/finance/summary'
import type { Tag } from '@/hooks/finance/tags'
import { formatCurrency, formatPeriodLong, previousPeriodLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

interface TagSpendingComparisonProps {
	granularity: SummaryGranularity
	period: SummaryPeriod
	previous: SummaryPeriod | undefined
	tags: Tag[]
}

export function TagSpendingComparison({
	granularity,
	period,
	previous,
	tags,
}: TagSpendingComparisonProps) {
	const rows = tags
		.map((tag) => ({
			id: tag.id,
			tag: tag as Tag | undefined,
			expense: Math.abs(period.byTag[tag.id] ?? 0),
			previous: previous ? Math.abs(previous.byTag[tag.id] ?? 0) : null,
		}))
		.filter((row) => row.expense > 0 || (row.previous ?? 0) > 0)
		.sort((a, b) => b.expense - a.expense)

	if (period.untagged < 0 || (previous?.untagged ?? 0) < 0) {
		rows.push({
			id: 'none',
			tag: undefined,
			expense: Math.abs(period.untagged),
			previous: previous ? Math.abs(previous.untagged) : null,
		})
	}

	const max = Math.max(...rows.map((row) => row.expense), 0)

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Gastos por tag</CardTitle>
				<CardDescription>
					{formatPeriodLong(granularity, period)}, comparado à {previousPeriodLabel(granularity)}.
					Uma transação com duas tags conta nas duas.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">Nenhuma saída no período.</p>
				) : (
					<ul className="flex flex-col gap-2">
						{rows.map((row) => {
							const delta = row.previous === null ? null : row.expense - row.previous
							return (
								<li
									key={row.id}
									className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,10rem)_1fr_auto_6rem]"
								>
									<span className="flex min-w-0 items-center gap-2">
										{row.tag ? (
											<TagDot color={row.tag.color} />
										) : (
											<span className="size-2 shrink-0 rounded-full border border-muted-foreground" />
										)}
										<span className={cn('truncate', !row.tag && 'text-muted-foreground')}>
											{row.tag?.name ?? 'Sem tag'}
										</span>
									</span>
									<span className="h-2 overflow-hidden rounded-full bg-muted">
										<span
											className="block h-full rounded-full bg-primary"
											style={{ width: `${max > 0 ? (row.expense / max) * 100 : 0}%` }}
										/>
									</span>
									<span className="text-right tabular-nums">{formatCurrency(row.expense)}</span>
									{/* Gastar mais é ruim: aumento em vermelho, queda em verde */}
									<span
										className={cn(
											'hidden text-right text-xs tabular-nums sm:block',
											delta === null || delta === 0
												? 'text-muted-foreground'
												: delta > 0
													? 'text-negative'
													: 'text-positive',
										)}
									>
										{delta === null
											? '—'
											: delta === 0
												? 'igual'
												: `${delta > 0 ? '▲' : '▼'} ${formatCurrency(Math.abs(delta))}`}
									</span>
								</li>
							)
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	)
}
