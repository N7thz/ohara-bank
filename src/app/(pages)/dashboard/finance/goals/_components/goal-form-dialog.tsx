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
import { type Goal, useCreateGoal, useUpdateGoal } from '@/hooks/finance/goals'
import { currencyInput, formatCurrencyInput, parseCurrency } from '@/lib/currency-input'

const goalSchema = z.object({
	name: z.string().trim().min(1, 'Informe o nome').max(60, 'Máximo de 60 caracteres'),
	targetAmount: z
		.string()
		.trim()
		.min(1, 'Informe o valor')
		.refine((value) => parseCurrency(value) > 0, 'Valor inválido'),
	targetMonth: z
		.string()
		.refine((value) => value === '' || /^\d{4}-(0[1-9]|1[0-2])$/.test(value), 'Mês inválido'),
})

type GoalFormData = z.infer<typeof goalSchema>

/** Meta a editar, `{}` para criar, null para fechar */
export type GoalFormInitial = Goal | Record<string, never> | null

const asGoal = (initial: GoalFormInitial) => (initial && 'id' in initial ? initial : null)

function toFormValues(initial: GoalFormInitial): GoalFormData {
	const goal = asGoal(initial)
	return {
		name: goal?.name ?? '',
		targetAmount: goal ? currencyInput(goal.targetAmount) : '',
		targetMonth: goal?.targetMonth ?? '',
	}
}

interface GoalFormDialogProps {
	initial: GoalFormInitial
	onClose: () => void
}

export function GoalFormDialog({ initial, onClose }: GoalFormDialogProps) {
	const { mutateAsync: createGoal } = useCreateGoal()
	const { mutateAsync: updateGoal } = useUpdateGoal()
	const editing = asGoal(initial)

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<GoalFormData>({
		resolver: zodResolver(goalSchema),
		defaultValues: toFormValues(null),
	})

	useEffect(() => {
		if (initial) reset(toFormValues(initial))
	}, [initial, reset])

	const amountField = register('targetAmount')

	async function onSubmit(data: GoalFormData) {
		const input = {
			name: data.name,
			targetAmount: parseCurrency(data.targetAmount),
			targetMonth: data.targetMonth || null,
		}
		try {
			if (editing) await updateGoal({ id: editing.id, ...input })
			else await createGoal(input)
			toast.success(editing ? 'Meta atualizada' : 'Meta criada')
			onClose()
		} catch (error) {
			toast.error((isAxiosError(error) && error.response?.data?.error) || 'Erro ao salvar a meta')
		}
	}

	return (
		<Dialog open={!!initial} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>{editing ? 'Editar meta' : 'Nova meta'}</DialogTitle>
						<DialogDescription>
							Defina quanto quer juntar. Com um mês-alvo, mostramos quanto guardar por mês.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="goal-name">Nome</Label>
						<Input
							id="goal-name"
							placeholder="Ex.: Reserva de emergência, Viagem"
							aria-invalid={!!errors.name}
							{...register('name')}
						/>
						{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="goal-target">Valor alvo</Label>
							<Input
								id="goal-target"
								inputMode="decimal"
								placeholder="0,00"
								aria-invalid={!!errors.targetAmount}
								{...amountField}
								onChange={(event) => {
									event.target.value = formatCurrencyInput(event.target.value)
									amountField.onChange(event)
								}}
							/>
							{errors.targetAmount && (
								<p className="text-xs text-destructive">{errors.targetAmount.message}</p>
							)}
						</div>

						<div className="flex flex-col gap-1.5">
							<Label htmlFor="goal-month">Mês-alvo</Label>
							<Input
								id="goal-month"
								type="month"
								aria-invalid={!!errors.targetMonth}
								{...register('targetMonth')}
							/>
							{errors.targetMonth ? (
								<p className="text-xs text-destructive">{errors.targetMonth.message}</p>
							) : (
								<p className="text-xs text-muted-foreground">Opcional</p>
							)}
						</div>
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
