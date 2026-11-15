import type { SummaryPeriod } from '@/hooks/finance/summary'
import type { Tag, TagColor } from '@/hooks/finance/tags'

// Mesma cor por tag do resto do app (TagDot): token --tag-* do tema
export const tagChartColor = (color: TagColor) => `var(--tag-${color})`
export const OTHERS_COLOR = 'var(--chart-5)'
export const UNTAGGED_COLOR = 'var(--muted-foreground)'

/** Quantas tags aparecem sozinhas; o resto vira "Outras" */
export const TOP_TAGS = 6

type Spending = Pick<SummaryPeriod, 'byTag' | 'untagged'>

/** Gasto (positivo) de uma tag; tag fora dos totais não entra */
export function tagSpend(period: Spending, tag: Tag) {
	return tag.excludeFromTotals ? 0 : Math.abs(period.byTag[tag.id] ?? 0)
}

/** As tags que mais gastaram somando os períodos dados, da maior para a menor */
export function topTags(periods: Spending[], tags: Tag[], limit = TOP_TAGS) {
	return tags
		.map((tag) => ({
			tag,
			total: periods.reduce((sum, period) => sum + tagSpend(period, tag), 0),
		}))
		.filter((item) => item.total > 0)
		.sort((a, b) => b.total - a.total)
		.slice(0, limit)
		.map((item) => item.tag)
}

/** Gasto das tags que ficaram fora do top (inclui tags apagadas) */
export function othersSpend(period: Spending, tags: Tag[], top: Tag[]) {
	const topIds = new Set(top.map((tag) => tag.id))
	const excluded = new Set(tags.filter((tag) => tag.excludeFromTotals).map((tag) => tag.id))
	return Object.entries(period.byTag)
		.filter(([id]) => !topIds.has(id) && !excluded.has(id))
		.reduce((sum, [, value]) => sum + Math.abs(value), 0)
}

/** Soma das fatias passa do total de saídas quando uma transação tem mais de uma tag */
export function hasTagOverlap(period: SummaryPeriod, tags: Tag[]) {
	const excluded = new Set(tags.filter((tag) => tag.excludeFromTotals).map((tag) => tag.id))
	const slices =
		Object.entries(period.byTag)
			.filter(([id]) => !excluded.has(id))
			.reduce((sum, [, value]) => sum + Math.abs(value), 0) + Math.abs(period.untagged)
	return slices > Math.abs(period.expense) + 0.005
}
