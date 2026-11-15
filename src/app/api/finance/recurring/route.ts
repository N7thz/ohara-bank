import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { localToday } from '@/lib/dates'
import { loadExpenses, splitPattern } from '@/lib/debts/match'
import { prisma } from '@/lib/prisma'
import { billHistory, findContacts, suggestBills } from '@/lib/recurring'
import { COUNTS_IN_TOTALS } from '@/lib/tags'

// Quanto do extrato olhar: um ano dá a sazonalidade da luz e os contatos do ano
const MONTHS_BACK = 12

export async function GET(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const userId = session.user.id
	const today = localToday()
	const since = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - MONTHS_BACK, 1))

	const [transactions, expenses, debts, latest, cards] = await Promise.all([
		// Contatos: entradas e saídas, sem transferências entre contas próprias
		prisma.transaction.findMany({
			where: { AND: [{ account: { userId } }, COUNTS_IN_TOTALS, { date: { gte: since } }] },
			select: { date: true, amount: true, description: true },
			orderBy: { date: 'desc' },
		}),
		loadExpenses(userId, since),
		// Parceladas têm fim e valor fixo: ficam só na página de Dívidas
		prisma.debt.findMany({
			where: { userId, kind: { in: ['FIXED', 'RECURRING'] } },
			select: { id: true, name: true, kind: true, amount: true, dueDay: true, pattern: true },
			orderBy: { name: 'asc' },
		}),
		prisma.transaction.findFirst({
			where: { account: { userId } },
			orderBy: { date: 'desc' },
			select: { date: true },
		}),
		prisma.bankAccount.findMany({
			where: { userId, type: 'CREDIT_CARD' },
			select: { id: true },
		}),
	])
	const cardIds = new Set(cards.map((card) => card.id))

	// Contas já cadastradas: o padrão da dívida junta os nomes diferentes da mesma empresa
	// ("telefonica|vivo-rj"); o histórico vem do extrato inteiro, não só desde o cadastro
	const bills = debts.map((debt) => {
		const patterns = splitPattern(debt.pattern)
		const payments = expenses.filter((tx) => patterns.some((pattern) => tx.text.includes(pattern)))
		const history = billHistory(payments, today, { dueDay: debt.dueDay })
		return {
			...history,
			debtId: debt.id,
			name: debt.name,
			// O tipo vem dos pagamentos (a internet "fixa" que subiu R$ 3 vira variável); sem pagamento, o cadastrado
			kind: history.count > 0 ? history.kind : debt.kind,
			amount: Number(debt.amount),
		}
	})

	return NextResponse.json({
		contacts: findContacts(
			transactions.map((tx) => ({ ...tx, amount: Number(tx.amount) })),
			today,
		),
		bills,
		suggestions: suggestBills(
			expenses.map((tx) => ({
				date: tx.date,
				amount: -tx.amount,
				description: tx.description,
				isCardPurchase: cardIds.has(tx.accountId),
			})),
			today,
			debts.map((debt) => debt.pattern),
		),
		importedUntil: latest ? latest.date.toISOString().slice(0, 10) : null,
	})
}
