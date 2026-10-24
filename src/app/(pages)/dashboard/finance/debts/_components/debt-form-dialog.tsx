'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
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
import type { DebtKind } from '@/hooks/finance/debts'
import { useSaveDebt } from '@/hooks/finance/debts'
import { currencyInput, formatCurrencyInput, parseCurrency } from './currency-input'
import { DEBT_KIND_LABEL } from './debt-labels'

const isIntBetween = (value: string, min: number, max: number) =>
	/^\d+$/.test(value) && Number(value) >= min && Number(value) <= max

const debtSchema = z
	.object({
		name: z.string().trim().min(1, 'Informe o nome').max(60, 'Máximo de 60 caracteres'),
		kind: z.enum(['FIXED', 'RECURRING', 'INSTALLMENT']),
		amount: z
			.string()
			.trim()
			.min(1, 'Informe o valor')
			.refine((value) => parseCurrency(value) > 0, 'Valor inválido'),
		dueDay: z
			.string()
			.trim()
			.refine((value) => value === '' || isIntBetween(value, 1, 31), 'Dia de 1 a 31'),
		installments: z.string().trim(),
		startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Informe o mês'),
		pattern: z
			.string()
			.trim()
			.min(3, 'Mínimo de 3 caracteres')
			.max(120, 'Máximo de 120 caracteres'),
	})
	.refine((debt) => debt.kind !== 'INSTALLMENT' || isIntBetween(debt.installments, 1, 480), {
		path: ['installments'],
		message: 'De 1 a 480 parcelas',
	})

type DebtFormData = z.infer<typeof debtSchema>

/** Valores iniciais: dívida existente, sugestão ou cadastro vazio */
export interface DebtFormInitial {
	id?: string
	name: string
	kind: DebtKind
	amount: number | null
	dueDay: number | null
	installments: number | null
	/** AAAA-MM */
	startMonth: string
	pattern: string
}

interface DebtFormDialogProps {
	/** null fecha o diálogo */
	initial: DebtFormInitial | null
	onClose: () => void
}

function toFormValues(initial: DebtFormInitial | null): DebtFormData {
	return {
		name: initial?.name ?? '',
		kind: initial?.kind ?? 'FIXED',
		amount: initial?.amount ? currencyInput(initial.amount) : '',
		dueDay: initial?.dueDay ? String(initial.dueDay) : '',
		installments: initial?.installments ? String(initial.installments) : '',
		startMonth: initial?.startMonth ?? '',
		pattern: initial?.pattern ?? '',
	}
}

const KINDS: DebtKind[] = ['FIXED', 'RECURRING', 'INSTALLMENT']

const AMOUNT_LABEL: Record<DebtKind, string> = {
	FIXED: 'Valor por mês',
	RECURRING: 'Valor médio por mês',
	INSTALLMENT: 'Valor da parcela',
}

export function DebtFormDialog({ initial, onClose }: DebtFormDialogProps) {
	const { mutateAsync: saveDebt } = useSaveDebt()

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<DebtFormData>({
		resolver: zodResolver(debtSchema),
		defaultValues: toFormValues(null),
	})

	useEffect(() => {
		if (initial) reset(toFormValues(initial))
	}, [initial, reset])

	const kind = watch('kind')
	const amountField = register('amount')
	const dueDayField = register('dueDay')
	const installmentsField = register('installments')

	async function onSubmit(data: DebtFormData) {
		try {
			await saveDebt({
				id: initial?.id,
				name: data.name,
				kind: data.kind,
				amount: parseCurrency(data.amount),
				dueDay: data.dueDay ? Number(data.dueDay) : null,
				installments: data.kind === 'INSTALLMENT' ? Number(data.installments) : null,
				startMonth: data.startMonth,
				pattern: data.pattern,
			})
			toast.success(initial?.id ? 'Dívida atualizada' : 'Dívida cadastrada')
			onClose()
		} catch (error) {
			toast.error((isAxiosError(error) && error.response?.data?.error) || 'Erro ao salvar a dívida')
		}
	}

	return (
		<Dialog open={!!initial} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>{initial?.id ? 'Editar dívida' : 'Nova dívida'}</DialogTitle>
						<DialogDescription>
							Os pagamentos são achados nas transações pelo trecho da descrição.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="debt-name">Nome</Label>
						<Input
							id="debt-name"
							placeholder="Ex.: Aluguel, Empréstimo Mercado Pago"
							aria-invalid={!!errors.name}
							{...register('name')}
						/>
						{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
					</div>

					<div className="flex flex-col gap-1.5">
						<Label>Tipo</Label>
						<div className="grid grid-cols-3 gap-2">
							{KINDS.map((value) => (
								<Button
									key={value}
									type="button"
									variant={kind === value ? 'default' : 'outline'}
									onClick={() => setValue('kind', value, { shouldValidate: true })}
								>
									{DEBT_KIND_LABEL[value]}
								</Button>
							))}
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="debt-amount">{AMOUNT_LABEL[kind]}</Label>
							<Input
								id="debt-amount"
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

						<div className="flex flex-col gap-1.5">
							<Label htmlFor="debt-due-day">Dia do vencimento</Label>
							<Input
								id="debt-due-day"
								inputMode="numeric"
								placeholder="Opcional"
								aria-invalid={!!errors.dueDay}
								{...dueDayField}
								onChange={(event) => {
									event.target.value = event.target.value.replace(/\D/g, '').slice(0, 2)
									dueDayField.onChange(event)
								}}
							/>
							{errors.dueDay && <p className="text-xs text-destructive">{errors.dueDay.message}</p>}
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="debt-start">
								{kind === 'INSTALLMENT' ? 'Mês da 1ª parcela' : 'Desde'}
							</Label>
							<Input
								id="debt-start"
								type="month"
								aria-invalid={!!errors.startMonth}
								{...register('startMonth')}
							/>
							{errors.startMonth && (
								<p className="text-xs text-destructive">{errors.startMonth.message}</p>
							)}
						</div>

						{kind === 'INSTALLMENT' && (
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="debt-installments">Nº de parcelas</Label>
								<Input
									id="debt-installments"
									inputMode="numeric"
									placeholder="Ex.: 12"
									aria-invalid={!!errors.installments}
									{...installmentsField}
									onChange={(event) => {
										event.target.value = event.target.value.replace(/\D/g, '').slice(0, 3)
										installmentsField.onChange(event)
									}}
								/>
								{errors.installments && (
									<p className="text-xs text-destructive">{errors.installments.message}</p>
								)}
							</div>
						)}
					</div>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="debt-pattern">Trecho da descrição no extrato</Label>
						<Input
							id="debt-pattern"
							placeholder="Ex.: disney plus"
							aria-invalid={!!errors.pattern}
							{...register('pattern')}
						/>
						{errors.pattern ? (
							<p className="text-xs text-destructive">{errors.pattern.message}</p>
						) : (
							<p className="text-xs text-muted-foreground">
								Toda saída cuja descrição contém esse trecho conta como pagamento. Maiúsculas e
								acentos não importam. Separe com | quando a conta aparece com descrições diferentes
								(ex.: telefonica|vivo-rj).
							</p>
						)}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Cancelar
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? 'Salvando...' : 'Salvar'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
