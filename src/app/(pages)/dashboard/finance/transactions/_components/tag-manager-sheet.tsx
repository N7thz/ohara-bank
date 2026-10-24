'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { PlusIcon, TagsIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { TAG_COLOR_LABEL, TAG_DOT, TagDot } from '@/components/finance/tag-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import type { Tag, TagColor } from '@/hooks/finance/tags'
import {
	useCreateTag,
	useCreateTagRule,
	useDeleteTag,
	useDeleteTagRule,
	useTags,
	useUpdateTag,
} from '@/hooks/finance/tags'

function errorMessage(error: unknown, fallback: string) {
	return (isAxiosError(error) && error.response?.data?.error) || fallback
}

interface AddFormProps {
	placeholder: string
	label: string
	disabled?: boolean
	onSubmit: (value: string) => Promise<unknown>
}

const addFormSchema = z.object({
	value: z.string().trim().min(1),
})

type AddFormData = z.infer<typeof addFormSchema>

// Campo com botão "+" que limpa depois de salvar
function AddForm({ placeholder, label, disabled, onSubmit }: AddFormProps) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<AddFormData>({
		resolver: zodResolver(addFormSchema),
		defaultValues: { value: '' },
	})

	async function handleAdd({ value }: AddFormData) {
		try {
			await onSubmit(value)
			reset()
		} catch {
			// O erro já virou toast em quem chamou
		}
	}

	return (
		<form onSubmit={handleSubmit(handleAdd)}>
			<InputGroup>
				<InputGroupInput
					placeholder={placeholder}
					aria-invalid={!!errors.value}
					disabled={disabled}
					{...register('value')}
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton type="submit" size="icon-xs" aria-label={label} disabled={disabled}>
						<PlusIcon />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</form>
	)
}

function TagItem({ tag }: { tag: Tag }) {
	const { mutate: updateTag } = useUpdateTag()
	const { mutate: deleteTag, isPending: isDeleting } = useDeleteTag()
	const { mutateAsync: createRule, isPending: isCreatingRule } = useCreateTagRule()
	const { mutate: deleteRule } = useDeleteTagRule()

	function handleDelete() {
		if (!confirm(`Remover a tag "${tag.name}"? Ela sai de todas as transações.`)) return
		deleteTag(tag.id, {
			onSuccess: () => toast.success(`Tag "${tag.name}" removida`),
			onError: () => toast.error('Erro ao remover tag'),
		})
	}

	async function handleAddRule(pattern: string) {
		try {
			const { applied } = await createRule({ tagId: tag.id, pattern })
			toast.success(
				applied > 0
					? `Regra criada e aplicada em ${applied} ${applied === 1 ? 'transação' : 'transações'}`
					: 'Regra criada; nenhuma transação existente bateu com ela',
			)
		} catch (error) {
			toast.error(errorMessage(error, 'Erro ao criar regra'))
			throw error
		}
	}

	return (
		<li className="flex flex-col gap-2 py-3">
			<div className="flex items-center gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button variant="ghost" size="icon-xs" aria-label={`Cor da tag ${tag.name}`} />}
					>
						<TagDot color={tag.color} className="size-3" />
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-36">
						<DropdownMenuGroup>
							<DropdownMenuLabel>Cor</DropdownMenuLabel>
							<DropdownMenuRadioGroup
								value={tag.color}
								onValueChange={(color) => updateTag({ id: tag.id, color: color as TagColor })}
							>
								{(Object.keys(TAG_DOT) as TagColor[]).map((color) => (
									<DropdownMenuRadioItem key={color} value={color}>
										<TagDot color={color} />
										{TAG_COLOR_LABEL[color]}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>

				<span className="flex-1 truncate font-medium">{tag.name}</span>
				<span className="text-xs text-muted-foreground">
					{tag.transactionCount} {tag.transactionCount === 1 ? 'transação' : 'transações'}
				</span>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label={`Remover tag ${tag.name}`}
					className="text-muted-foreground hover:text-destructive"
					disabled={isDeleting}
					onClick={handleDelete}
				>
					<Trash2Icon />
				</Button>
			</div>

			<div className="flex flex-col gap-2 pl-8">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<Switch
						id={`exclude-${tag.id}`}
						size="sm"
						checked={tag.excludeFromTotals}
						onCheckedChange={(checked) =>
							updateTag(
								{ id: tag.id, excludeFromTotals: checked },
								{ onError: () => toast.error('Erro ao salvar a tag') },
							)
						}
					/>
					<label htmlFor={`exclude-${tag.id}`}>
						Fora dos totais (transferência entre contas, não é entrada nem gasto)
					</label>
				</div>
				{tag.rules.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{tag.rules.map((rule) => (
							<Badge key={rule.id} variant="secondary" className="pr-0.5">
								contém "{rule.pattern}"
								<button
									type="button"
									aria-label={`Remover regra ${rule.pattern}`}
									className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
									onClick={() =>
										deleteRule(
											{ tagId: tag.id, ruleId: rule.id },
											{ onError: () => toast.error('Erro ao remover regra') },
										)
									}
								>
									<XIcon />
								</button>
							</Badge>
						))}
					</div>
				)}
				<AddForm
					placeholder='Regra: descrição contém… (ex.: "uber")'
					label={`Adicionar regra à tag ${tag.name}`}
					disabled={isCreatingRule}
					onSubmit={handleAddRule}
				/>
			</div>
		</li>
	)
}

export function TagManagerSheet() {
	const { data: tags = [] } = useTags()
	const { mutateAsync: createTag, isPending } = useCreateTag()

	async function handleCreate(name: string) {
		try {
			await createTag({ name })
			toast.success(`Tag "${name}" criada`)
		} catch (error) {
			toast.error(errorMessage(error, 'Erro ao criar tag'))
			throw error
		}
	}

	return (
		<Sheet>
			<SheetTrigger render={<Button variant="outline" />}>
				<TagsIcon data-icon="inline-start" />
				Tags
			</SheetTrigger>
			<SheetContent className="w-full sm:max-w-md">
				<SheetHeader>
					<SheetTitle>Tags</SheetTitle>
					<SheetDescription>
						Agrupe gastos com tags. Uma regra marca as transações cuja descrição contém o texto, sem
						diferenciar maiúsculas e acentos. Vale para as transações existentes e para as próximas
						importações.
					</SheetDescription>
				</SheetHeader>

				<div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
					<AddForm
						placeholder="Nova tag (ex.: Mercado)"
						label="Criar tag"
						disabled={isPending}
						onSubmit={handleCreate}
					/>
					<Separator />
					{tags.length === 0 ? (
						<p className="text-sm text-muted-foreground">Nenhuma tag criada ainda.</p>
					) : (
						<ul className="flex flex-col divide-y">
							{tags.map((tag) => (
								<TagItem key={tag.id} tag={tag} />
							))}
						</ul>
					)}
				</div>
			</SheetContent>
		</Sheet>
	)
}
