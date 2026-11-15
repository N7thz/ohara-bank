'use client'

import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { TagBadge, TagDot } from '@/components/finance/tag-badge'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Tag } from '@/hooks/finance/tags'
import { useSetTransactionTags } from '@/hooks/finance/transactions'
import { CreateRuleDialog } from './create-rule-dialog'

interface TransactionTagsCellProps {
	transactionId: string
	tagIds: string[]
	tags: Tag[]
	/** Descrição da transação: com ela o menu oferece criar uma regra de tag */
	description?: string
}

export function TransactionTagsCell({
	transactionId,
	tagIds,
	tags,
	description,
}: TransactionTagsCellProps) {
	const { mutate: setTags, isPending } = useSetTransactionTags()
	const [ruleOpen, setRuleOpen] = useState(false)

	const selected = tags.filter((tag) => tagIds.includes(tag.id))

	function toggle(tagId: string, checked: boolean) {
		const next = checked ? [...tagIds, tagId] : tagIds.filter((id) => id !== tagId)
		setTags(
			{ transactionId, tagIds: next },
			{ onError: () => toast.error('Erro ao salvar as tags') },
		)
	}

	return (
		<div className="flex flex-wrap items-center gap-1">
			{selected.map((tag) => (
				<TagBadge key={tag.id} tag={tag} />
			))}

			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="Editar tags"
							className="text-muted-foreground"
							disabled={isPending}
						/>
					}
				>
					<PlusIcon />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Tags</DropdownMenuLabel>
						{tags.length === 0 && (
							<p className="px-1.5 py-1 text-xs text-muted-foreground">
								Nenhuma tag criada. Use o botão "Tags" acima.
							</p>
						)}
						{tags.map((tag) => (
							<DropdownMenuCheckboxItem
								key={tag.id}
								checked={tagIds.includes(tag.id)}
								onCheckedChange={(checked) => toggle(tag.id, checked)}
							>
								<TagDot color={tag.color} />
								{tag.name}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuGroup>
					{description && tags.length > 0 && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setRuleOpen(true)}>
								Criar regra com esta descrição…
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			{description && tags.length > 0 && (
				<CreateRuleDialog
					open={ruleOpen}
					onOpenChange={setRuleOpen}
					description={description}
					tags={tags}
					tagIds={tagIds}
				/>
			)}
		</div>
	)
}
