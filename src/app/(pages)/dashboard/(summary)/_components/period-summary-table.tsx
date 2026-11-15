'use client'

import { TagDot } from '@/components/finance/tag-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import type { SummaryGranularity, SummaryPeriod } from '@/hooks/finance/summary'
import type { Tag } from '@/hooks/finance/tags'
import { formatCurrency, formatPeriodLong } from '@/lib/format'
import { cn } from '@/lib/utils'

interface PeriodSummaryTableProps {
	granularity: SummaryGranularity
	periods: SummaryPeriod[]
	tags: Tag[]
	selectedStart: string | null
	onSelect: (start: string) => void
}

export function PeriodSummaryTable({
	granularity,
	periods,
	tags,
	selectedStart,
	onSelect,
}: PeriodSummaryTableProps) {
	const tagsById = new Map(tags.map((tag) => [tag.id, tag]))

	// Tag com o maior gasto no período
	function topTag(period: SummaryPeriod) {
		const [tagId, expense] = Object.entries(period.byTag).sort(([, a], [, b]) => a - b)[0] ?? []
		const tag = tagId ? tagsById.get(tagId) : undefined
		return tag && expense !== undefined ? { tag, expense } : null
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">
					Resumo {granularity === 'month' ? 'mensal' : 'semanal'}
				</CardTitle>
				<CardDescription>
					Os mesmos números do gráfico. Clique numa linha para ver o período.
				</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="pl-4">Período</TableHead>
							<TableHead className="text-right">Entradas</TableHead>
							<TableHead className="text-right">Saídas</TableHead>
							<TableHead className="text-right">Saldo</TableHead>
							<TableHead className="hidden text-right sm:table-cell">Transações</TableHead>
							<TableHead className="hidden pr-4 lg:table-cell">Maior gasto</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{[...periods].reverse().map((period) => {
							const balance = period.income + period.expense
							const top = topTag(period)
							const isSelected = period.start === selectedStart
							return (
								<TableRow
									key={period.start}
									data-state={isSelected ? 'selected' : undefined}
									className={cn('cursor-pointer', period.count === 0 && 'text-muted-foreground')}
									onClick={() => onSelect(period.start)}
								>
									<TableCell className="pl-4 font-medium">
										{/* Botão para teclado e leitor de tela; o clique na linha toda continua valendo */}
										<button
											type="button"
											aria-pressed={isSelected}
											onClick={(event) => {
												event.stopPropagation()
												onSelect(period.start)
											}}
											className="rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
										>
											{formatPeriodLong(granularity, period)}
										</button>
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatCurrency(period.income)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatCurrency(Math.abs(period.expense))}
									</TableCell>
									<TableCell
										className={cn(
											'text-right font-medium tabular-nums',
											period.count > 0 && (balance >= 0 ? 'text-positive' : 'text-negative'),
										)}
									>
										{formatCurrency(balance)}
									</TableCell>
									<TableCell className="hidden text-right tabular-nums sm:table-cell">
										{period.count}
									</TableCell>
									<TableCell className="hidden pr-4 lg:table-cell">
										{top ? (
											<span className="flex items-center gap-2">
												<TagDot color={top.tag.color} />
												{top.tag.name}
												<span className="text-muted-foreground tabular-nums">
													{formatCurrency(Math.abs(top.expense))}
												</span>
											</span>
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</TableCell>
								</TableRow>
							)
						})}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	)
}
