import { Badge } from '@/components/ui/badge'
import type { Tag, TagColor } from '@/hooks/finance/tags'
import { cn } from '@/lib/utils'

// Classes escritas por extenso para o Tailwind encontrar
export const TAG_DOT: Record<TagColor, string> = {
	blue: 'bg-tag-blue',
	orange: 'bg-tag-orange',
	aqua: 'bg-tag-aqua',
	yellow: 'bg-tag-yellow',
	magenta: 'bg-tag-magenta',
	violet: 'bg-tag-violet',
}

export const TAG_COLOR_LABEL: Record<TagColor, string> = {
	blue: 'Azul',
	orange: 'Laranja',
	aqua: 'Água',
	yellow: 'Amarelo',
	magenta: 'Magenta',
	violet: 'Violeta',
}

export function TagDot({ color, className }: { color: TagColor; className?: string }) {
	return <span className={cn('size-2 shrink-0 rounded-full', TAG_DOT[color], className)} />
}

/** A cor só ajuda a reconhecer; o nome vai sempre junto */
export function TagBadge({ tag }: { tag: Pick<Tag, 'name' | 'color'> }) {
	return (
		<Badge variant="outline">
			<TagDot color={tag.color} />
			{tag.name}
		</Badge>
	)
}
