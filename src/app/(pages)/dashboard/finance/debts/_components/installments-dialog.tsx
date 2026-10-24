'use client'

import { UTCDate } from '@date-fns/utc'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { addMonths, startOfMonth } from 'date-fns'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Debt } from '@/hooks/finance/debts'
import { useSaveDebt } from '@/hooks/finance/debts'
import { formatCurrency, formatPeriodShort } from '@/lib/format'
import { currencyInput, formatCurrencyInput, parseCurrency } from './currency-input'

const installmentsSchema = z.object({
	pending: z
		.string()
		.trim()
		.regex(/^\d+$/, 'Informe quantas faltam')
		.refine((value) => Number(value) <= 480, 'No máximo 480'),
	amount: z
		.string()
		.trim()
		.min(1, 'Informe o valor')
		.refine((value) => parseCurrency(value) > 0, 'Valor inválido'),
})

type InstallmentsData = z.infer<typeof installmentsSchema>

interface InstallmentsDialogProps {
	/** null fecha o diálogo */
	debt: Debt | null
	onClose: () => void
}

/** Mês da última parcela: as que faltam vêm uma por mês, a partir de agora */
function projectedEnd(debt: Debt, pending: number) {
	const current = startOfMonth(new UTCDate())
	const next = debt.paidThisMonth > 0 ? addMonths(current, 1) : current
	const start = new UTCDate(`${debt.startMonth}T00:00:00Z`)
	return addMonths(next < start ? start : next, pending - 1)
}

/**
 * Transforma a conta em parcelada (ou ajusta a parcelada): cada mês com pagamento já
 * achado conta como parcela paga, e as parcelas pendentes vêm depois
 */
export function InstallmentsDialog({ debt, onClose }: InstallmentsDialogProps) {
	const { mutateAsync: saveDebt } = useSaveDebt()

	const {
		register,
		handleSubmit,
		reset,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<InstallmentsData>({
		resolver: zodResolver(installmentsSchema),
		defaultValues: { pending: '', amount: '' },
	})

	useEffect(() => {
		if (!debt) return
		const pending =
			debt.kind === 'INSTALLMENT' && debt.installments
				? String(Math.max(0, debt.installments - debt.paidMonths))
				: ''
		reset({ pending, amount: currencyInput(debt.amount) })
	}, [debt, reset])

	const pendingField = register('pending')
	const amountField = register('amount')

	const paid = debt?.paidMonths ?? 0
	const pendingValue = watch('pending')
	const pending = /^\d+$/.test(pendingValue) ? Number(pendingValue) : null
	const total = pending === null ? null : paid + pending
	const amount = parseCurrency(watch('amount'))

	async function onSubmit(data: InstallmentsData) {
		if (!debt) return
		const installments = paid + Number(data.pending)
		if (installments < 1) {
			toast.error('Sem pagamentos achados, informe ao menos 1 parcela pendente')
			return
		}
		try {
			await saveDebt({
				id: debt.id,
				name: debt.name,
				kind: 'INSTALLMENT',
				amount: parseCurrency(data.amount),
				dueDay: debt.dueDay,
				installments,
				startMonth: debt.startMonth.slice(0, 7),
				pattern: debt.pattern,
			})
			toast.success(
				Number(data.pending) === 0
					? `${debt.name} quitada`
					: `${debt.name}: ${data.pending} ${Number(data.pending) === 1 ? 'parcela pendente' : 'parcelas pendentes'}`,
			)
			onClose()
		} catch (error) {
			toast.error(
				(isAxiosError(error) && error.response?.data?.error) || 'Erro ao salvar as parcelas',
			)
		}
	}

	return (
		<Dialog open={!!debt} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>Parcelas pendentes</DialogTitle>
						<DialogDescription>
							{debt?.kind === 'INSTALLMENT'
								? `Ajuste quantas parcelas de "${debt?.name}" ainda faltam.`
								: `"${debt?.name}" vira uma dívida parcelada. Cada mês com pagamento já achado conta como uma parcela paga.`}
						</DialogDescription>
					</DialogHeader>

					<p className="rounded-lg bg-muted px-3 py-2 text-sm">
						{paid === 0
							? 'Nenhum pagamento achado ainda.'
							: `${paid} ${paid === 1 ? 'parcela paga' : 'parcelas pagas'} (meses com pagamento desde ${debt ? formatPeriodShort('month', { start: debt.startMonth, end: debt.startMonth }) : ''}).`}
					</p>

					<div className="grid grid-cols-2 gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="installments-pending">Parcelas que faltam</Label>
							<Input
								id="installments-pending"
								inputMode="numeric"
								placeholder="Ex.: 6"
								autoFocus
								aria-invalid={!!errors.pending}
								{...pendingField}
								onChange={(event) => {
									event.target.value = event.target.value.replace(/\D/g, '').slice(0, 3)
									pendingField.onChange(event)
								}}
							/>
							{errors.pending && (
								<p className="text-xs text-destructive">{errors.pending.message}</p>
							)}
						</div>

						<div className="flex flex-col gap-1.5">
							<Label htmlFor="installments-amount">Valor da parcela</Label>
							<Input
								id="installments-amount"
								inputMode="decimal"
								placeholder="0,00"
								aria-invalid={!!errors.amount}
								{...amountField}
								onChange={(event) => {
									event.target.value = formatCurrencyInput(event.target.value)
									amountField.onChange(event)
								}}
							/>
							{errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
						</div>
					</div>

					{debt && total !== null && total > 0 && pending !== null && (
						<p className="text-sm text-muted-foreground">
							Total de <span className="font-medium text-foreground">{total} parcelas</span>
							{pending > 0 ? (
								<>
									{Number.isFinite(amount) && amount > 0 && (
										<>
											. Faltam{' '}
											<span className="font-medium text-foreground">
												{formatCurrency(pending * amount)}
											</span>
										</>
									)}
									, última em{' '}
									<span className="font-medium text-foreground">
										{formatPeriodShort('month', {
											start: projectedEnd(debt, pending).toISOString(),
											end: projectedEnd(debt, pending).toISOString(),
										})}
									</span>
									.
								</>
							) : (
								', todas pagas: a dívida fica quitada.'
							)}
						</p>
					)}

					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Cancelar
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? 'Salvando...' : 'Salvar parcelas'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
