'use client'

import { HandCoinsIcon, ListOrderedIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { HeroMetric } from '@/components/finance/hero-metric'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import type { Debt, DebtKind } from '@/hooks/finance/debts'
import { useDebts, useDeleteDebt } from '@/hooks/finance/debts'
import { formatCurrency, formatDate, formatPeriodShort } from '@/lib/format'
import { DebtFormDialog, type DebtFormInitial } from './debt-form-dialog'
import { DEBT_KIND_LABEL, DEBT_KIND_SECTION, DEBT_STATUS } from './debt-labels'
import { DebtsChart } from './debts-chart'
import { InstallmentsDialog } from './installments-dialog'

const KINDS: DebtKind[] = ['FIXED', 'RECURRING', 'INSTALLMENT']

// Ainda conta no mês: não quitada e já começou
const isActive = (debt: Debt) => debt.status !== 'finished' && debt.status !== 'not-started'

/** Quanto falta pagar da dívida no mês atual */
function dueThisMonth(debt: Debt) {
	if (!isActive(debt) || debt.status === 'paid') return 0
	return Math.max(0, debt.amount - debt.paidThisMonth)
}

const currentMonth = () => new Date().toISOString().slice(0, 7)

interface DebtCardProps {
	debt: Debt
	onEdit: () => void
	onInstallments: () => void
}

function DebtCard({ debt, onEdit, onInstallments }: DebtCardProps) {
	const { mutate: deleteDebt, isPending: isDeleting } = useDeleteDebt()
	const status = DEBT_STATUS[debt.status]

	function handleDelete() {
		if (!confirm(`Remover a dívida "${debt.name}"? As transações não são apagadas.`)) return
		deleteDebt(debt.id, {
			onSuccess: () => toast.success('Dívida removida'),
			onError: () => toast.error('Erro ao remover a dívida'),
		})
	}

	return (
		<Card size="sm" className="hover-lift">
			<CardHeader>
				<div className="flex items-start justify-between gap-2">
					<div className="flex min-w-0 flex-col gap-1">
						<CardTitle className="truncate text-base" title={debt.name}>
							{debt.name}
						</CardTitle>
						<CardDescription>
							{formatCurrency(debt.amount)}
							{debt.kind === 'INSTALLMENT' ? ' por parcela' : ' por mês'}
							{debt.dueDay && ` · vence dia ${debt.dueDay}`}
						</CardDescription>
					</div>
					<Badge variant={status.variant}>{status.label}</Badge>
				</div>
			</CardHeader>
			<CardContent className="flex flex-col gap-3 text-sm">
				{debt.kind === 'INSTALLMENT' && debt.installments && (
					<div className="flex flex-col gap-1.5">
						<div className="flex justify-between gap-2">
							<span>
								{debt.paidInstallments} de {debt.installments} parcelas
							</span>
							{debt.endMonth && (
								<span className="text-muted-foreground">
									última em{' '}
									{formatPeriodShort('month', { start: debt.endMonth, end: debt.endMonth })}
								</span>
							)}
						</div>
						<Progress
							value={((debt.paidInstallments ?? 0) / debt.installments) * 100}
							aria-label={`${debt.paidInstallments} de ${debt.installments} parcelas pagas`}
						/>
						<span className="text-xs text-muted-foreground">
							Pago {formatCurrency(debt.paidTotal)} · falta{' '}
							{formatCurrency(debt.remainingAmount ?? 0)}
						</span>
					</div>
				)}

				{debt.status === 'partial' && (
					<p className="text-xs text-muted-foreground">
						Este mês: {formatCurrency(debt.paidThisMonth)} de {formatCurrency(debt.amount)}
					</p>
				)}

				<div className="flex items-end justify-between gap-2">
					<p className="min-w-0 text-xs text-muted-foreground">
						{debt.lastPayment ? (
							<>
								Último pagamento em {formatDate(debt.lastPayment.date)} ·{' '}
								{formatCurrency(debt.lastPayment.amount)}
							</>
						) : (
							<>
								Nenhum pagamento achado com <span className="font-mono">"{debt.pattern}"</span>
							</>
						)}
					</p>
					<div className="flex shrink-0 gap-1">
						{debt.status !== 'finished' && (
							<Button variant="outline" size="sm" onClick={onInstallments}>
								<ListOrderedIcon />
								{debt.kind === 'INSTALLMENT' ? 'Parcelas' : 'Parcelar'}
							</Button>
						)}
						<Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={onEdit}>
							<PencilIcon />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Remover"
							className="text-muted-foreground hover:text-destructive"
							disabled={isDeleting}
							onClick={handleDelete}
						>
							<Trash2Icon />
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export function DebtsView() {
	const { data, isLoading, isError } = useDebts()
	const [form, setForm] = useState<DebtFormInitial | null>(null)
	const [installmentsDebt, setInstallmentsDebt] = useState<Debt | null>(null)

	const debts = data?.debts ?? []
	const current = data?.months.findLast((month) => month.paid !== null)

	const active = debts.filter(isActive)
	const paidThisMonth = active.reduce((sum, debt) => sum + debt.paidThisMonth, 0)
	const dueTotal = active.reduce((sum, debt) => sum + dueThisMonth(debt), 0)
	const installmentBalance = debts.reduce((sum, debt) => sum + (debt.remainingAmount ?? 0), 0)

	function newDebt() {
		setForm({
			name: '',
			kind: 'FIXED',
			amount: null,
			dueDay: null,
			installments: null,
			startMonth: currentMonth(),
			pattern: '',
		})
	}

	function editDebt(debt: Debt) {
		setForm({
			id: debt.id,
			name: debt.name,
			kind: debt.kind,
			amount: debt.amount,
			dueDay: debt.dueDay,
			installments: debt.installments,
			startMonth: debt.startMonth.slice(0, 7),
			pattern: debt.pattern,
		})
	}

	return (
		<div className="stagger page-stack">
			<PageHeader
				title="Dívidas"
				description="Contas fixas, recorrentes e parceladas, com os pagamentos achados nas transações."
				actions={
					<Button onClick={newDebt}>
						<PlusIcon />
						Nova dívida
					</Button>
				}
				aside={
					(isLoading || debts.length > 0) && (
						<HeroMetric
							label="Falta pagar no mês"
							value={data ? dueTotal : undefined}
							hint="Recorrentes contam como pagas no primeiro pagamento do mês"
							items={
								data && [
									{
										label: 'Previsto no mês',
										value: current?.expected ?? 0,
										hint: `${active.length} ${active.length === 1 ? 'dívida ativa' : 'dívidas ativas'}`,
									},
									{ label: 'Pago no mês', value: paidThisMonth, className: 'text-green-600' },
									{
										label: 'Saldo das parceladas',
										value: installmentBalance,
										hint: 'Parcelas que ainda faltam',
									},
								]
							}
							footnote={
								data?.importedUntil &&
								`Extratos importados até ${formatDate(data.importedUntil)}. Pagamentos depois dessa data ainda não aparecem.`
							}
						/>
					)
				}
			>
				{isError && <p className="text-sm text-destructive">Erro ao carregar as dívidas.</p>}
			</PageHeader>

			{isLoading && <Skeleton className="h-96" />}

			{data && debts.length === 0 && (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<HandCoinsIcon />
						</EmptyMedia>
						<EmptyTitle>Nenhuma dívida cadastrada</EmptyTitle>
						<EmptyDescription>
							Cadastre uma dívida ou use uma das sugestões abaixo, tiradas dos gastos que se repetem
							todo mês.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button onClick={newDebt}>
							<PlusIcon />
							Nova dívida
						</Button>
					</EmptyContent>
				</Empty>
			)}

			{data && debts.length > 0 && (
				<PageSection
					title="Previsto e pago"
					description="Últimos 6 meses e os próximos 6. Nos meses futuros, só o previsto."
				>
					<DebtsChart months={data.months} />
				</PageSection>
			)}

			{KINDS.map((kind) => {
				const items = debts.filter((debt) => debt.kind === kind)
				if (items.length === 0) return null
				return (
					<PageSection
						key={kind}
						title={DEBT_KIND_SECTION[kind].title}
						description={`${DEBT_KIND_SECTION[kind].description} ${items.length} ${items.length === 1 ? 'dívida' : 'dívidas'}.`}
						className="reveal"
					>
						<div className="stagger grid gap-4 md:grid-cols-2">
							{items.map((debt) => (
								<DebtCard
									key={debt.id}
									debt={debt}
									onEdit={() => editDebt(debt)}
									onInstallments={() => setInstallmentsDebt(debt)}
								/>
							))}
						</div>
					</PageSection>
				)
			})}

			{data && data.suggestions.length > 0 && (
				<PageSection
					title="Sugestões"
					description="Saídas que se repetem em 3 meses ou mais nos últimos 6 e ainda não estão cadastradas."
					className="reveal"
				>
					<ul className="divide-y rounded-xl border bg-card">
						{data.suggestions.map((suggestion) => (
							<li key={suggestion.pattern} className="flex items-center gap-3 px-4 py-3 text-sm">
								<div className="flex min-w-0 flex-1 flex-col">
									<span className="truncate font-medium" title={suggestion.name}>
										{suggestion.name}
									</span>
									<span className="text-xs text-muted-foreground">
										{DEBT_KIND_LABEL[suggestion.kind]} · ~{formatCurrency(suggestion.amount)} por
										mês · em {suggestion.months} meses
									</span>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setForm({
											name: suggestion.name,
											kind: suggestion.kind,
											amount: suggestion.amount,
											dueDay: suggestion.dueDay,
											installments: null,
											startMonth: suggestion.firstMonth,
											pattern: suggestion.pattern,
										})
									}
								>
									<PlusIcon />
									Cadastrar
								</Button>
							</li>
						))}
					</ul>
				</PageSection>
			)}

			<DebtFormDialog initial={form} onClose={() => setForm(null)} />
			<InstallmentsDialog debt={installmentsDebt} onClose={() => setInstallmentsDebt(null)} />
		</div>
	)
}
