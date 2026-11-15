import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { csvCell, csvTextCell } from '@/lib/csv-cell'
import { prisma } from '@/lib/prisma'
import {
	searchParamsObject,
	transactionFiltersSchema,
	transactionWhere,
} from '@/lib/transaction-filters'

// Excel em português espera ";" entre colunas e vírgula decimal
const SEPARATOR = ';'

// Colunas de texto vindas de dados externos (descrição, conta, tags): neutralizam fórmulas
const TEXT_COLUMNS = new Set([1, 3, 4])

const line = (row: string[], isHeader = false) =>
	row
		.map((value, i) => (!isHeader && TEXT_COLUMNS.has(i) ? csvTextCell(value) : csvCell(value)))
		.join(SEPARATOR)

export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const query = transactionFiltersSchema.safeParse(searchParamsObject(request))
	if (!query.success) {
		return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })
	}

	const { where } = transactionWhere(session.user.id, query.data)
	const transactions = await prisma.transaction.findMany({
		where,
		orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
		select: {
			date: true,
			description: true,
			amount: true,
			account: { select: { bankName: true, number: true } },
			tags: { select: { tag: { select: { name: true, excludeFromTotals: true } } } },
		},
	})

	const header = ['Data', 'Descrição', 'Valor', 'Conta', 'Tags', 'Fora dos totais']
	const rows = transactions.map((tx) => {
		// Gravadas à meia-noite UTC: o dia certo está na parte UTC
		const [year, month, day] = tx.date.toISOString().slice(0, 10).split('-')
		return [
			`${day}/${month}/${year}`,
			tx.description,
			tx.amount.toFixed(2).replace('.', ','),
			`${tx.account.bankName} ${tx.account.number}`,
			tx.tags.map(({ tag }) => tag.name).join(', '),
			tx.tags.some(({ tag }) => tag.excludeFromTotals) ? 'sim' : 'não',
		]
	})

	// BOM para o Excel reconhecer UTF-8 e mostrar os acentos
	const csv = `﻿${[line(header, true), ...rows.map((row) => line(row))].join('\r\n')}\r\n`
	const fileName = `transacoes${query.data.month ? `-${query.data.month}` : ''}.csv`

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${fileName}"`,
		},
	})
}
