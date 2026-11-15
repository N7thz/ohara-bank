import { z } from 'zod'
import type { Prisma } from '../../prisma/generated/client'

// Filtros da lista de transações, usados também na exportação em CSV

export const transactionFiltersSchema = z.object({
	accountId: z.string().optional(),
	/** AAAA-MM */
	month: z
		.string()
		.regex(/^\d{4}-(0[1-9]|1[0-2])$/)
		.optional(),
	type: z.enum(['income', 'expense']).optional(),
	q: z.string().trim().max(100).optional(),
	/** Id da tag, ou "none" para transações sem tag */
	tagId: z.string().optional(),
})

export type TransactionFiltersInput = z.infer<typeof transactionFiltersSchema>

/** Parâmetros da URL sem os vazios, prontos para o schema */
export function searchParamsObject(request: Request) {
	return Object.fromEntries(
		[...new URL(request.url).searchParams].filter(([, value]) => value !== ''),
	)
}

export function transactionWhere(
	userId: string,
	{ accountId, month, type, q, tagId }: TransactionFiltersInput,
) {
	// Datas são gravadas à meia-noite UTC, então o mês vai de dia 1 até o dia 1 seguinte
	let date: Prisma.DateTimeFilter | undefined
	if (month) {
		const [year, monthIndex] = month.split('-').map(Number)
		date = {
			gte: new Date(Date.UTC(year, monthIndex - 1, 1)),
			lt: new Date(Date.UTC(year, monthIndex, 1)),
		}
	}

	// Conta e busca valem para tudo, inclusive o histórico mensal
	const allMonths: Prisma.TransactionWhereInput = {
		account: { userId },
		...(accountId && { accountId }),
		...(q && { description: { contains: q, mode: 'insensitive' } }),
	}
	// O período vale para tudo menos o histórico mensal, inclusive o agrupamento por tag
	const scope: Prisma.TransactionWhereInput = { ...allMonths, ...(date && { date }) }
	// A tag filtra lista, totais e histórico; o tipo só filtra a lista
	const tagFilter: Prisma.TransactionWhereInput = {
		...(tagId === 'none' && { tags: { none: {} } }),
		...(tagId && tagId !== 'none' && { tags: { some: { tagId } } }),
	}
	const base: Prisma.TransactionWhereInput = { ...scope, ...tagFilter }
	const where: Prisma.TransactionWhereInput = {
		...base,
		...(type === 'income' && { amount: { gt: 0 } }),
		...(type === 'expense' && { amount: { lt: 0 } }),
	}

	return { allMonths, scope, tagFilter, base, where }
}
