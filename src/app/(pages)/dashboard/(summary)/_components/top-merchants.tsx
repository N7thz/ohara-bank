'use client'

import { ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'
import { TagDot } from '@/components/finance/tag-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { MerchantRanking, SummaryGranularity } from '@/hooks/finance/summary'
import type { Tag } from '@/hooks/finance/tags'
import { formatCurrency, previousPeriodLabel } from '@/lib/format'

interface TopMerchantsProps {
	granularity: SummaryGranularity
	/** Primeiro dia do período (AAAA-MM-DD) */
	periodStart: string
	accountId: string | undefined
	data: MerchantRanking | undefined
	tags: Tag[]
}

// Busca do lugar na lista de transações, no mesmo mês e conta
function transactionsHref(query: string, periodStart: string, accountId: string | undefined) {
	const params = new URLSearchParams({ q: query, month: periodStart.slice(0, 7) })
	if (accountId) params.set('accountId', accountId)
	return `/dashboard/finance/transactions?${params}`
}

export function TopMerchants({
	granularity,
	periodStart,
	accountId,
	data,
	tags,
}: TopMerchantsProps) {
	if (!data) return <Skeleton className="h-80" />

	if (data.merchants.length === 0) {
		return <p className="text-sm text-muted-foreground">Nenhuma saída no período.</p>
	}

	const tagById = new Map(tags.map((tag) => [tag.id, tag]))
	const max = data.merchants[0].total
	const topShare =
		data.total > 0
			? data.merchants.slice(0, 3).reduce((sum, m) => sum + m.total, 0) / data.total
			: 0

	return (
		<div className="grid gap-6 md:grid-cols-[3fr_2fr]">
			<Card>
				<CardContent>
					<ol className="flex flex-col">
						{data.merchants.map((merchant, index) => {
							const tag = merchant.tagId ? tagById.get(merchant.tagId) : undefined
							const delta = merchant.previous === null ? null : merchant.total - merchant.previous
							return (
								<li key={merchant.query}>
									{/* Na semana, a busca abre o mês inteiro: é o filtro de data que a lista tem */}
									<Link
										href={transactionsHref(merchant.query, periodStart, accountId)}
										className="group grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
									>
										<span className="text-sm text-muted-foreground tabular-nums">{index + 1}</span>
										<span className="flex min-w-0 items-center gap-2">
											<span className="truncate font-medium">{merchant.name}</span>
											{tag && (
												<span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
													<TagDot color={tag.color} />
													{tag.name}
												</span>
											)}
										</span>
										<span className="flex items-center gap-1 text-right font-medium tabular-nums">
											{formatCurrency(merchant.total)}
											<ChevronRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
										</span>

										<span />
										<span className="h-1.5 overflow-hidden rounded-full bg-muted">
											<span
												className="block h-full origin-left rounded-full bg-primary transition-transform duration-700 ease-out"
												style={{ transform: `scaleX(${max > 0 ? merchant.total / max : 0})` }}
											/>
										</span>
										<span className="flex justify-end gap-2 text-xs tabular-nums">
											<span className="text-muted-foreground">
												{merchant.count} {merchant.count === 1 ? 'compra' : 'compras'}
											</span>
											{/* Gastar mais é ruim: aumento em vermelho */}
											{delta !== null && delta !== 0 && (
												<span className={delta > 0 ? 'text-negative' : 'text-positive'}>
													{delta > 0 ? '▲' : '▼'} {formatCurrency(Math.abs(delta))}
												</span>
											)}
										</span>
									</Link>
								</li>
							)
						})}
					</ol>
					{data.others.count > 0 && (
						<p className="px-2 pt-2 text-xs text-muted-foreground">
							Mais {data.others.count} {data.others.count === 1 ? 'lugar' : 'lugares'} somando{' '}
							{formatCurrency(data.others.total)}.
						</p>
					)}
				</CardContent>
			</Card>

			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-1">
					<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Os 3 primeiros levam
					</span>
					<span className="text-[clamp(2.5rem,5vw,4rem)] font-bold leading-none tracking-tight tabular-nums">
						{Math.round(topShare * 100)}%
					</span>
					<span className="text-sm text-muted-foreground">
						das saídas do período ({formatCurrency(data.total)}).
					</span>
				</div>
				<p className="text-sm text-muted-foreground">
					Lugares agrupados pelo nome no extrato, sem prefixos como "Compra no débito" e "MP *".
					Setas comparam com a {previousPeriodLabel(granularity)}. Clique para ver as compras.
				</p>
			</div>
		</div>
	)
}
