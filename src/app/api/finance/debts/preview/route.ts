import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { loadExpenses, matchPayments } from '@/lib/debts/match'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

// Prévia do formulário de dívida: quais saídas casam com o trecho digitado, pela mesma
// regra que acha os pagamentos da dívida
export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const params = new URL(request.url).searchParams
	const pattern = (params.get('pattern') ?? '').trim().slice(0, 120)
	const month = params.get('startMonth') ?? ''
	if (pattern.length < 3) {
		return NextResponse.json({ error: 'Trecho muito curto' }, { status: 400 })
	}

	const startMonth = MONTH.test(month) ? new Date(`${month}-01T00:00:00Z`) : new Date(0)
	const expenses = await loadExpenses(session.user.id, startMonth)
	const { matched } = matchPayments({ startMonth, pattern }, expenses)

	return NextResponse.json({
		count: matched.length,
		// loadExpenses ordena do mais antigo para o mais novo
		recent: matched
			.slice(-3)
			.reverse()
			.map((tx) => ({ id: tx.id, date: tx.date, amount: tx.amount, description: tx.description })),
	})
}
