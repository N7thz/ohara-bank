'use client'

import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTransactions } from '@/hooks/finance/transactions'
import { formatCurrency, formatDate } from '@/lib/format'

// O card mostra só as mais recentes; a lista completa fica na página de Transações
const PREVIEW_SIZE = 8

interface StatementTransactionListProps {
	accountId: string
}

export function StatementTransactionList({ accountId }: StatementTransactionListProps) {
	const { data, isLoading } = useTransactions({ accountId, page: 1, pageSize: PREVIEW_SIZE })
	const transactions = data?.transactions ?? []

	if (isLoading) {
		return (
			<div className="flex flex-col gap-2 p-4">
				{['a', 'b', 'c', 'd'].map((key) => (
					<Skeleton key={key} className="h-8 w-full" />
				))}
			</div>
		)
	}

	if (transactions.length === 0) {
		return <p className="p-4 text-sm text-muted-foreground">Nenhuma transação encontrada.</p>
	}

	return (
		<div className="flex flex-col border-t">
			<ul className="divide-y">
				{transactions.map((tx) => (
					<li key={tx.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium">{tx.description}</span>
							<span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
						</div>
						<span
							className={
								tx.amount >= 0
									? 'shrink-0 font-medium text-green-600 tabular-nums'
									: 'shrink-0 font-medium text-red-500 tabular-nums'
							}
						>
							{tx.amount >= 0 ? '+' : '-'}
							{formatCurrency(Math.abs(tx.amount))}
						</span>
					</li>
				))}
			</ul>
			{data && data.total > transactions.length && (
				<Button
					variant="ghost"
					size="sm"
					className="m-2 self-center"
					render={<Link href={`/dashboard/finance/transactions?accountId=${accountId}`} />}
				>
					Ver todas as {data.total} transações
					<ArrowRightIcon data-icon="inline-end" />
				</Button>
			)}
		</div>
	)
}
