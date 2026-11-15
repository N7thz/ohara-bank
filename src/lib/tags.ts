import { prisma } from '@/lib/prisma'
import type { Prisma } from '../../prisma/generated/client'
import { normalizeText } from './text'

// Paleta categórica sem vermelho e verde, que já indicam saída e entrada nos valores.
// A cor só ajuda a reconhecer: o nome da tag aparece sempre ao lado. Tons em globals.css
export const TAG_COLORS = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'violet'] as const

export type TagColor = (typeof TAG_COLORS)[number]

/** Filtro das transações que contam nos totais: sem nenhuma tag marcada "fora dos totais" */
export const COUNTS_IN_TOTALS = {
	tags: { none: { tag: { excludeFromTotals: true } } },
} satisfies Prisma.TransactionWhereInput

/** O contrário: transferências entre contas e afins */
export const EXCLUDED_FROM_TOTALS = {
	tags: { some: { tag: { excludeFromTotals: true } } },
} satisfies Prisma.TransactionWhereInput

export { normalizeText } from './text'

interface ApplyRulesOptions {
	userId: string
	/** Só estas regras (ex.: a que acabou de ser criada) */
	ruleIds?: string[]
	/** Só estas transações (ex.: as que acabaram de ser importadas) */
	transactionIds?: string[]
}

/** Aplica as regras de tag nas transações do usuário; devolve quantas tags foram adicionadas */
export async function applyTagRules({ userId, ruleIds, transactionIds }: ApplyRulesOptions) {
	if (transactionIds?.length === 0) return 0

	const rules = await prisma.tagRule.findMany({
		where: { tag: { userId }, ...(ruleIds && { id: { in: ruleIds } }) },
		select: { tagId: true, pattern: true },
	})
	if (rules.length === 0) return 0

	const transactions = await prisma.transaction.findMany({
		where: { account: { userId }, ...(transactionIds && { id: { in: transactionIds } }) },
		select: { id: true, description: true },
	})

	const patterns = rules.map((rule) => ({
		tagId: rule.tagId,
		pattern: normalizeText(rule.pattern),
	}))
	const data = transactions.flatMap((tx) => {
		const description = normalizeText(tx.description)
		return patterns
			.filter((rule) => description.includes(rule.pattern))
			.map((rule) => ({ transactionId: tx.id, tagId: rule.tagId }))
	})
	if (data.length === 0) return 0

	const { count } = await prisma.transactionTag.createMany({ data, skipDuplicates: true })
	return count
}
