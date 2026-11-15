import { prisma } from '@/lib/prisma'
import { assignPayments, loadExpenses, matchPayments, monthKey, monthStart } from './match'

// Usado por /api/finance/transactions: "parcela 3 de 10" em cada transação

export interface InstallmentLabel {
	debtId: string
	debtName: string
	number: number
	total: number
}

/** Parcela de cada transação que paga uma dívida parcelada, por id da transação */
export async function getInstallmentLabels(userId: string) {
	// Todas as dívidas: uma transação que casa com duas conta só para a mais específica
	const allDebts = await prisma.debt.findMany({ where: { userId } })
	const debts = allDebts.filter((debt) => debt.kind === 'INSTALLMENT' && debt.installments !== null)
	const labels = new Map<string, InstallmentLabel>()
	if (debts.length === 0) return labels

	const since = allDebts.reduce(
		(min, debt) => (debt.startMonth < min ? debt.startMonth : min),
		allDebts[0].startMonth,
	)
	const expenses = await loadExpenses(userId, monthStart(since))
	const owned = assignPayments(allDebts, expenses)

	for (const debt of debts) {
		const total = debt.installments as number
		const matched = matchPayments(debt, expenses).matched.filter((tx) =>
			owned.get(debt.id)?.has(tx.id),
		)
		const paidMonths = [...new Set(matched.map((tx) => monthKey(tx.date)))]
		for (const tx of matched) {
			// As parcelas pagas à mão vêm antes das achadas nas transações
			const number = debt.paidBefore + paidMonths.indexOf(monthKey(tx.date)) + 1
			// Pagamento depois da última parcela não ganha número
			if (number <= total) {
				labels.set(tx.id, { debtId: debt.id, debtName: debt.name, number, total })
			}
		}
	}
	return labels
}
