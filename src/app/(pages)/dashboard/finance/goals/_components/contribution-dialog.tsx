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
import { type Goal, useAddContribution } from '@/hooks/finance/goals'
import { formatCurrencyInput, parseCurrency } from '@/lib/currency-input'
import { localTodayKey } from '@/lib/dates'
import { formatCurrency } from '@/lib/format'

const contributionSchema = z.object({
	amount: z
		.string()
		.trim()
		.min(1, 'Informe o valor')
		.refine((value) => parseCurrency(value) > 0, 'Valor inválido'),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data'),
	note: z.string().trim().max(120, 'Máximo de 120 caracteres'),
})

type ContributionFormData = z.infer<typeof contributionSchema>

export interface ContributionTarget {
	goal: Goal
	mode: 'save' | 'withdraw'
}

const emptyValues = (): ContributionFormData => ({ amount: '', date: localTodayKey(), note: '' })

interface ContributionDialogProps {
	target: ContributionTarget | null
	onClose: () => void
}

export function ContributionDialog({ target, onClose }: ContributionDialogProps) {
	const { mutateAsync: addContribution } = useAddContribution()
	const withdraw = target?.mode === 'withdraw'

	const {
		register,
		handleSubmit,
		reset,
		setError,
		formState: { errors, isSubmitting },
	} = useForm<ContributionFormData>({
		resolver: zodResolver(contributionSchema),
		defaultValues: emptyValues(),
	})

	useEffect(() => {
		if (target) reset(emptyValues())
	}, [target, reset])

	const amountField = register('amount')

	async function onSubmit(data: ContributionFormData) {
		if (!target) return
		const amount = parseCurrency(data.amount)
		if (withdraw && amount > target.goal.saved) {
			setError('amount', { message: `Você só tem ${formatCurrency(target.goal.saved)} guardado` })
			return
		}
		try {
			await addContribution({
				goalId: target.goal.id,
				amount: withdraw ? -amount : amount,
				date: data.date,
				note: data.note || null,
			})
			toast.success(withdraw ? 'Retirada registrada' : 'Valor guardado')
			onClose()
		} catch (error) {
			toast.error(
				(isAxiosError(error) && error.response?.data?.error) || 'Erro ao registrar o valor',
			)
		}
	}

	return (
		<Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>
							{withdraw ? 'Retirar de' : 'Guardar em'} {target?.goal.name}
						</DialogTitle>
						<DialogDescription>
							{withdraw
								? 'Registra o dinheiro que saiu da meta. O guardado diminui; as transações não mudam.'
								: 'Registra o dinheiro que você separou para a meta. As transações não mudam.'}
						</DialogDescription>
					</DialogHeader>

					<div className="grid grid-cols-2 gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="contribution-amount">Valor</Label>
							<Input
								id="contribution-amount"
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
							<Label htmlFor="contribution-date">Data</Label>
							<Input
								id="contribution-date"
								type="date"
								aria-invalid={!!errors.date}
								{...register('date')}
							/>
							{errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="contribution-note">Observação</Label>
						<Input
							id="contribution-note"
							placeholder="Opcional"
							aria-invalid={!!errors.note}
							{...register('note')}
						/>
						{errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Cancelar
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? 'Salvando...' : withdraw ? 'Retirar' : 'Guardar'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
