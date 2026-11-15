'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { TagDot } from '@/components/finance/tag-badge'
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
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import type { Tag } from '@/hooks/finance/tags'
import { useCreateTagRule } from '@/hooks/finance/tags'

const ruleSchema = z.object({
	tagId: z.string().min(1, 'Escolha a tag'),
	pattern: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(60, 'Máximo de 60 caracteres'),
})

type RuleFormData = z.infer<typeof ruleSchema>

interface CreateRuleDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** Descrição da transação de origem: vira o trecho inicial da regra */
	description: string
	tags: Tag[]
	/** Tags da transação: se for exatamente uma, já vem escolhida */
	tagIds: string[]
}

function toFormValues(description: string, tagIds: string[]): RuleFormData {
	return {
		tagId: tagIds.length === 1 ? tagIds[0] : '',
		// A regra aceita até 60 caracteres
		pattern: description.trim().slice(0, 60).trim(),
	}
}

export function CreateRuleDialog({
	open,
	onOpenChange,
	description,
	tags,
	tagIds,
}: CreateRuleDialogProps) {
	const { mutateAsync: createRule } = useCreateTagRule()

	const {
		register,
		control,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<RuleFormData>({
		resolver: zodResolver(ruleSchema),
		defaultValues: toFormValues(description, tagIds),
	})

	// Cada abertura recomeça do estado da transação
	useEffect(() => {
		if (open) reset(toFormValues(description, tagIds))
	}, [open, description, tagIds, reset])

	const tagItems = tags.map((tag) => ({ value: tag.id, label: tag.name }))

	async function onSubmit({ tagId, pattern }: RuleFormData) {
		try {
			const { applied } = await createRule({ tagId, pattern })
			toast.success(
				`Regra criada: ${applied} ${applied === 1 ? 'transação marcada' : 'transações marcadas'}`,
			)
			onOpenChange(false)
		} catch (error) {
			toast.error((isAxiosError(error) && error.response?.data?.error) || 'Erro ao criar a regra')
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>Criar regra de tag</DialogTitle>
						<DialogDescription>
							A regra vale para as transações já importadas e para as futuras.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="rule-tag">Tag</Label>
						<Controller
							control={control}
							name="tagId"
							render={({ field }) => (
								<Select
									items={tagItems}
									value={field.value || null}
									onValueChange={(value) => field.onChange(value ?? '')}
								>
									<SelectTrigger id="rule-tag" className="w-full" aria-invalid={!!errors.tagId}>
										<SelectValue placeholder="Escolha a tag" />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{tags.map((tag) => (
												<SelectItem key={tag.id} value={tag.id}>
													<TagDot color={tag.color} />
													{tag.name}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							)}
						/>
						{errors.tagId && <p className="text-xs text-destructive">{errors.tagId.message}</p>}
					</div>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="rule-pattern">Descrição contém</Label>
						<Input
							id="rule-pattern"
							placeholder="Ex.: uber"
							aria-invalid={!!errors.pattern}
							{...register('pattern')}
						/>
						{errors.pattern ? (
							<p className="text-xs text-destructive">{errors.pattern.message}</p>
						) : (
							<p className="text-xs text-muted-foreground">
								Maiúsculas e acentos não importam. Deixe só a parte que se repete, como o nome do
								estabelecimento.
							</p>
						)}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancelar
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? 'Criando...' : 'Criar regra'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
