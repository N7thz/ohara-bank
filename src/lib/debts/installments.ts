import { prisma } from '@/lib/prisma'
import { loadExpenses, matchPayments, monthKey, monthStart } from './match'

// Usado por /api/finance/transactions: "parcela 3 de 10" em cada transação

export interface InstallmentLabel {
	debtId: string
	debtName: string
	number: number
	total: number
}

/** Parcela de cada transação que paga uma dívida parcelada, por id da transação */
export async function getInstallmentLabels(userId: string) {
	const debts = await prisma.debt.findMany({
		where: { userId, kind: 'INSTALLMENT', installments: { not: null } },
	})
	const labels = new Map<string, InstallmentLabel>()
	if (debts.length === 0) return labels

	const since = debts.reduce(
		(min, debt) => (debt.startMonth < min ? debt.startMonth : min),
		debts[0].startMonth,
	)
	const expenses = await loadExpenses(userId, monthStart(since))

	for (const debt of debts) {
		const total = debt.installments as number
		const { matched, paidMonths } = matchPayments(debt, expenses)
		for (const tx of matched) {
			const number = paidMonths.indexOf(monthKey(tx.date)) + 1
			// Pagamento depois da última parcela não ganha número
			if (number <= total) {
				labels.set(tx.id, { debtId: debt.id, debtName: debt.name, number, total })
			}
		}
	}
	return labels
}
