'use client'

import { utc } from '@date-fns/utc'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PlusIcon, RepeatIcon, UsersIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { HeroMetric } from '@/components/finance/hero-metric'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { QueryError } from '@/components/query-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import type { BillSuggestion, TrackedBill } from '@/hooks/finance/recurring'
import { useRecurring } from '@/hooks/finance/recurring'
import { localTodayKey } from '@/lib/dates'
import { formatCurrency, formatDate } from '@/lib/format'
import { DebtFormDialog, type DebtFormInitial } from '../../debts/_components/debt-form-dialog'
import { BillCard } from './bill-card'
import { ContactsLegend, ContactsList } from './contacts-list'
import { MonthBars } from './month-bars'

/** O que a conta deve custar no mês atual: o pago, se já saiu; senão a estimativa */
const expectedThisMonth = (bill: TrackedBill) =>
	bill.paidThisMonth > 0 ? bill.paidThisMonth : bill.estimate

function SuggestionRow({
	suggestion,
	onTrack,
}: {
	suggestion: BillSuggestion
	onTrack: () => void
}) {
	return (
		<li className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-center">
			<div className="flex min-w-0 flex-col gap-1">
				<span className="flex min-w-0 items-center gap-2">
					<Link
						href={`/dashboard/finance/transactions?${new URLSearchParams({ q: suggestion.query })}`}
						className="truncate font-medium hover:underline"
						title={suggestion.name}
					>
						{suggestion.name}
					</Link>
					{suggestion.isPerson && <Badge variant="secondary">Pessoa</Badge>}
				</span>
				<span className="text-xs text-muted-foreground tabular-nums">
					{suggestion.months} meses · média {formatCurrency(suggestion.average)}
					{suggestion.kind === 'RECURRING' &&
						` · de ${formatCurrency(suggestion.min)} a ${formatCurrency(suggestion.max)}`}
				</span>
			</div>
			<MonthBars data={suggestion.monthly.slice(-12)} average={suggestion.average} />
			<Button variant="outline" size="sm" onClick={onTrack}>
				<PlusIcon />
				Acompanhar
			</Button>
		</li>
	)
}

export function RecurringView() {
	const { data, isLoading, isError, refetch, isRefetching } = useRecurring()
	const [form, setForm] = useState<DebtFormInitial | null>(null)

	const today = localTodayKey()
	const monthName = format(today, 'MMMM', { in: utc, locale: ptBR })

	const bills = data?.bills ?? []
	const active = bills.filter((bill) => bill.active)
	const variable = bills.filter((bill) => bill.kind === 'RECURRING')
	const fixed = bills.filter((bill) => bill.kind === 'FIXED')
	const expected = active.reduce((sum, bill) => sum + expectedThisMonth(bill), 0)
	const paid = active.reduce((sum, bill) => sum + bill.paidThisMonth, 0)

	function track(suggestion: BillSuggestion) {
		setForm({
			name: suggestion.name,
			kind: suggestion.kind,
			amount: suggestion.estimate,
			dueDay: suggestion.typicalDay,
			installments: null,
			startMonth:
				suggestion.monthly.find((month) => month.amount !== null)?.month ?? today.slice(0, 7),
			pattern: suggestion.pattern,
		})
	}

	return (
		<div className="stagger page-stack">
			<PageHeader
				eyebrow="Últimos 12 meses"
				title="Recorrentes"
				description="Contas que voltam todo mês, mesmo quando o valor muda, e as pessoas com quem você troca Pix com frequência. Tudo calculado a partir dos extratos importados."
				aside={
					<HeroMetric
						label={`Contas de ${monthName}`}
						value={data ? expected : undefined}
						hint={data?.importedUntil && `Extrato até ${formatDate(data.importedUntil)}`}
						items={
							data
								? [
										{ label: 'Já pago', value: paid, className: 'text-positive' },
										{ label: 'Falta, estimado', value: Math.max(0, expected - paid) },
									]
								: undefined
						}
						footnote="Contas ainda não pagas entram pela média dos 3 últimos meses pagos."
					/>
				}
			>
				{isError && (
					<QueryError
						message="Não foi possível analisar os extratos."
						onRetry={() => refetch()}
						retrying={isRefetching}
					/>
				)}
			</PageHeader>

			<PageSection
				title="Contas que mudam de valor"
				description="Luz, faturas e afins: a barra tracejada é a estimativa do mês que ainda não saiu; a linha tracejada, a média."
			>
				{isLoading ? (
					<div className="grid gap-6 md:grid-cols-2">
						<Skeleton className="h-64" />
						<Skeleton className="h-64" />
					</div>
				) : variable.length > 0 ? (
					<div className="grid gap-6 md:grid-cols-2">
						{variable.map((bill) => (
							<BillCard key={bill.debtId} bill={bill} today={today} />
						))}
					</div>
				) : (
					<Empty className="border">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<RepeatIcon />
							</EmptyMedia>
							<EmptyTitle>Nenhuma conta de valor variável</EmptyTitle>
							<EmptyDescription>
								Cadastre a conta em Dívidas como recorrente, ou acompanhe uma das sugestões abaixo.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button
								variant="outline"
								nativeButton={false}
								render={<Link href="/dashboard/finance/debts" />}
							>
								Ir para Dívidas
							</Button>
						</EmptyContent>
					</Empty>
				)}
			</PageSection>

			<PageSection
				title="Contatos recorrentes"
				description="Pessoas com 2 Pix ou mais no ano, nos dois sentidos. Clique para ver as transferências."
				actions={<ContactsLegend />}
			>
				{isLoading ? (
					<Skeleton className="h-96" />
				) : data && data.contacts.length > 0 ? (
					<ContactsList contacts={data.contacts} />
				) : (
					<Empty className="border">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<UsersIcon />
							</EmptyMedia>
							<EmptyTitle>Nenhum contato recorrente</EmptyTitle>
							<EmptyDescription>
								Quando houver 2 Pix ou mais com a mesma pessoa, ela aparece aqui.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
			</PageSection>

			{fixed.length > 0 && (
				<PageSection
					title="Valor fixo"
					description="Assinaturas e contas que custam sempre o mesmo."
				>
					<Card>
						<CardContent>
							<ul className="flex flex-col divide-y">
								{fixed.map((bill) => (
									<li key={bill.debtId} className="flex items-center justify-between gap-4 py-3">
										<div className="flex min-w-0 flex-col">
											<span className="truncate font-medium">{bill.name}</span>
											<span className="text-xs text-muted-foreground">
												{bill.paidThisMonth > 0
													? `Paga este mês`
													: bill.active
														? `Vence por volta do dia ${Number(bill.nextDue.slice(8))}`
														: 'Sem pagamento recente'}
											</span>
										</div>
										<span className="font-medium tabular-nums">
											{formatCurrency(bill.count > 0 ? bill.average : bill.amount)}
										</span>
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
				</PageSection>
			)}

			{data && data.suggestions.length > 0 && (
				<PageSection
					title="Sugestões"
					description="Saídas que voltam em 3 meses ou mais e ainda não estão em Dívidas. Acompanhar cria a conta lá, já com o nome que aparece no extrato."
				>
					<Card>
						<CardContent className="px-0">
							<ul className="flex flex-col divide-y">
								{data.suggestions.map((suggestion) => (
									<SuggestionRow
										key={suggestion.key}
										suggestion={suggestion}
										onTrack={() => track(suggestion)}
									/>
								))}
							</ul>
						</CardContent>
					</Card>
				</PageSection>
			)}

			<DebtFormDialog initial={form} onClose={() => setForm(null)} />
		</div>
	)
}
