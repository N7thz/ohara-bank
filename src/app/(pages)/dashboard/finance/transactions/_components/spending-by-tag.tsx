'use client'

import { TagDot } from '@/components/finance/tag-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Tag } from '@/hooks/finance/tags'
import type { TransactionsOverview } from '@/hooks/finance/transactions'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

export const UNTAGGED = 'none'

interface SpendingByTagProps {
	tags: Tag[]
	byTag: TransactionsOverview['byTag']
	untagged: TransactionsOverview['untagged']
	/** Tag filtrada na tabela, ou "none" */
	activeTagId: string | null
	onSelect: (tagId: string | null) => void
}

export function SpendingByTag({
	tags,
	byTag,
	untagged,
	activeTagId,
	onSelect,
}: SpendingByTagProps) {
	const tagsById = new Map(tags.map((tag) => [tag.id, tag]))

	const rows = byTag
		.filter((group) => group.expense < 0 && tagsById.has(group.tagId))
		.map((group) => ({
			id: group.tagId,
			tag: tagsById.get(group.tagId),
			expense: Math.abs(group.expense),
			count: group.expenseCount,
		}))
		.sort((a, b) => b.expense - a.expense)

	// "Sem tag" fica por último, fora da ordenação
	if (untagged.count > 0) {
		rows.push({
			id: UNTAGGED,
			tag: undefined,
			expense: Math.abs(untagged.expense),
			count: untagged.count,
		})
	}

	const max = Math.max(...rows.map((row) => row.expense), 0)

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Gastos por tag</CardTitle>
				<CardDescription>
					Saídas com conta, mês e busca (sem o filtro de tag). Uma transação com duas tags conta nas
					duas. Clique para filtrar.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">Nenhuma saída no período.</p>
				) : (
					<ul className="flex flex-col gap-1">
						{rows.map((row) => {
							const isActive = activeTagId === row.id
							return (
								<li key={row.id}>
									<button
										type="button"
										aria-pressed={isActive}
										onClick={() => onSelect(isActive ? null : row.id)}
										className={cn(
											'grid w-full grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
											isActive && 'bg-muted',
										)}
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
										<span className="text-right tabular-nums">
											{formatCurrency(row.expense)}
											<span className="ml-2 text-xs text-muted-foreground">{row.count}×</span>
										</span>
									</button>
								</li>
							)
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	)
}
