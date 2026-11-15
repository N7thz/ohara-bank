/** Transação com alguma tag "fora dos totais" (transferência entre contas próprias) */
export function isExcludedFromTotals(tags: { tag: { excludeFromTotals: boolean } }[]) {
	return tags.some(({ tag }) => tag.excludeFromTotals)
}
