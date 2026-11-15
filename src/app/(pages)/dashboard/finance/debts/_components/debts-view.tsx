'use client'

import {
	ChevronDownIcon,
	HandCoinsIcon,
	ListOrderedIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { HeroMetric } from '@/components/finance/hero-metric'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useDebts, useDeleteDebt, useSaveDebt, useSetDebtStatus } from '@/hooks/finance/debts'
import { useRecurring } from '@/hooks/finance/recurring'
import { localMonthKey } from '@/lib/dates'
import { formatCurrency, formatDate, formatPeriodShort } from '@/lib/format'
import { DebtFormDialog, type DebtFormInitial } from './debt-form-dialog'
import { DEBT_KIND_SECTION, DEBT_OVERRIDE_OPTIONS, DEBT_STATUS } from './debt-labels'
import { DebtsChart } from './debts-chart'
import { InstallmentsDialog } from './installments-dialog'
import { PayoffChart } from './payoff-chart'

const KINDS: DebtKind[] = ['FIXED', 'RECURRING', 'INSTALLMENT']

// Ainda conta no mês: não quitada e já começou
const isActive = (debt: Debt) => debt.status !== 'finished' && debt.status !== 'not-started'

/** Quanto falta pagar da dívida no mês atual */
function dueThisMonth(debt: Debt) {
	if (!isActive(debt) || debt.status === 'paid' || debt.status === 'skipped') return 0
	return Math.max(0, debt.amount - debt.paidThisMonth)
}

const currentMonth = () => localMonthKey()

// Fixas e recorrentes ativas: a situação do mês pode ser marcada à mão
function DebtStatusMenu({ debt }: { debt: Debt }) {
	const { mutate: setStatus, isPending } = useSetDebtStatus()
	const status = DEBT_STATUS[debt.status]

	if (debt.kind === 'INSTALLMENT' || !isActive(debt)) {
		return <Badge variant={status.variant}>{status.label}</Badge>
	}

	function handleChange(value: string) {
		const option = DEBT_OVERRIDE_OPTIONS.find((item) => item.value === value)
		if (!option) return
		const next = option.value === 'auto' ? null : option.value
		setStatus(
			{ id: debt.id, status: next },
			{
				onSuccess: () =>
					toast.success(
						next === null
							? `"${debt.name}" voltou para a situação automática`
							: `"${debt.name}" marcada como "${option.label.toLowerCase()}" neste mês`,
					),
				onError: () => toast.error('Erro ao mudar a situação'),
			},
		)
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button
						type="button"
						className="shrink-0 rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
						aria-label={`Mudar a situação de ${debt.name} neste mês`}
						disabled={isPending}
					/>
				}
			>
				<Badge variant={status.variant}>
					{status.label}
					<ChevronDownIcon />
				</Badge>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Situação neste mês</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={debt.statusOverride ?? 'auto'}
						onValueChange={handleChange}
					>
						{DEBT_OVERRIDE_OPTIONS.map((option) => (
							<DropdownMenuRadioItem key={option.value} value={option.value}>
								{option.value === 'auto'
									? `${option.label} (${DEBT_STATUS[debt.autoStatus].label.toLowerCase()})`
									: option.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

interface DebtCardProps {
	debt: Debt
	onEdit: () => void
	onInstallments: () => void
}

function DebtCard({ debt, onEdit, onInstallments }: DebtCardProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	const { mutateAsync: deleteDebt } = useDeleteDebt()
	const { mutateAsync: saveDebt } = useSaveDebt()

	async function handleDelete() {
		await deleteDebt(debt.id)
		toast.success(`Dívida "${debt.name}" removida`, {
			duration: 8000,
			action: {
				label: 'Desfazer',
				// Recria com os mesmos dados; só as situações marcadas à mão em cada mês se perdem
				onClick: () =>
					saveDebt({
						name: debt.name,
						kind: debt.kind,
						amount: debt.amount,
						dueDay: debt.dueDay,
						installments: debt.installments,
						paidBefore: debt.paidBefore,
						startMonth: debt.startMonth.slice(0, 7),
						pattern: debt.pattern,
					}).then(
						() => toast.success(`Dívida "${debt.name}" de volta`),
						() => toast.error('Não foi possível desfazer. Cadastre a dívida de novo.'),
					),
			},
		})
	}

	return (
		<Card size="sm">
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
					<DebtStatusMenu debt={debt} />
				</div>
				{debt.statusOverride && (
					<p className="text-xs text-muted-foreground">
						Marcada à mão neste mês · pelas transações:{' '}
						{DEBT_STATUS[debt.autoStatus].label.toLowerCase()}
					</p>
				)}
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
					<div className="flex shrink-0 items-center gap-2">
						{debt.status !== 'finished' && (
							<Button variant="outline" className="h-10 px-3" onClick={onInstallments}>
								<ListOrderedIcon />
								{debt.kind === 'INSTALLMENT' ? 'Parcelas' : 'Parcelar'}
							</Button>
						)}
						<Button
							variant="ghost"
							size="icon"
							className="size-10"
							aria-label={`Editar ${debt.name}`}
							onClick={onEdit}
						>
							<PencilIcon />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="size-10 text-muted-foreground hover:text-destructive"
							aria-label={`Remover ${debt.name}`}
							onClick={() => setConfirmingDelete(true)}
						>
							<Trash2Icon />
						</Button>
					</div>
				</div>
			</CardContent>
			<ConfirmDialog
				open={confirmingDelete}
				onOpenChange={setConfirmingDelete}
				title={`Remover a dívida "${debt.name}"?`}
				description={
					<p>
						A dívida sai da lista e dos cálculos do mês. As transações do extrato não são apagadas.
						Você pode desfazer logo depois pelo aviso que aparece.
					</p>
				}
				confirmLabel="Remover dívida"
				destructive
				errorMessage="Erro ao remover a dívida"
				onConfirm={handleDelete}
			/>
		</Card>
	)
}

export function DebtsView() {
	const { data, isLoading, isError } = useDebts()
	const [form, setForm] = useState<DebtFormInitial | null>(null)
	const [installmentsDebt, setInstallmentsDebt] = useState<Debt | null>(null)

	const { data: recurring } = useRecurring()
	const suggestionCount = recurring?.suggestions.length ?? 0

	const debts = data?.debts ?? []
	const current = data?.months.findLast((month) => month.paid !== null)

	const active = debts.filter(isActive)
	const paidThisMonth = active.reduce((sum, debt) => sum + debt.paidThisMonth, 0)
	const dueTotal = active.reduce((sum, debt) => sum + dueThisMonth(debt), 0)
	const hasOpenInstallments = debts.some(
		(debt) =>
			debt.kind === 'INSTALLMENT' &&
			debt.status !== 'finished' &&
			debt.endMonth !== null &&
			(debt.remainingAmount ?? 0) > 0,
	)
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
			paidBefore: debt.paidBefore,
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
									{
										label: 'Pago no mês',
										// Inclui as contas marcadas como pagas por fora do extrato
										value: current?.paid ?? paidThisMonth,
										className: 'text-positive',
									},
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
							Cadastre uma dívida à mão ou veja em Recorrentes as saídas que se repetem todo mês.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button onClick={newDebt}>
							<PlusIcon />
							Nova dívida
						</Button>
						<Button
							variant="secondary"
							nativeButton={false}
							render={<Link href="/dashboard/finance/recurring" />}
						>
							Ver Recorrentes
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

			{hasOpenInstallments && (
				<PageSection
					title="Quitação das parceladas"
					description="Quando você fica livre das parcelas, se não surgir nenhuma nova."
				>
					<PayoffChart debts={debts} />
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

			{suggestionCount > 0 && (
				<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
					<span>
						{suggestionCount}{' '}
						{suggestionCount === 1 ? 'conta que se repete' : 'contas que se repetem'} ainda não{' '}
						{suggestionCount === 1 ? 'está cadastrada' : 'estão cadastradas'}.
					</span>
					<Link
						href="/dashboard/finance/recurring"
						className="font-medium text-primary underline-offset-4 hover:underline"
					>
						Ver sugestões em Recorrentes
					</Link>
				</p>
			)}

			<DebtFormDialog initial={form} onClose={() => setForm(null)} />
			<InstallmentsDialog debt={installmentsDebt} onClose={() => setInstallmentsDebt(null)} />
		</div>
	)
}
