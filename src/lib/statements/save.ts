import { prisma } from '@/lib/prisma'
import { applyTagRules } from '@/lib/tags'
import type { ParsedStatement } from './types'

/** Grava conta e transações; transações já importadas são ignoradas */
export async function saveStatement(userId: string, statement: ParsedStatement) {
	const { bankName, number, type, balance, balanceDate } = statement

	const account = await prisma.bankAccount.upsert({
		where: { userId_bankName_number: { userId, bankName, number } },
		create: { userId, bankName, number, type, balance, balanceDate },
		update: {},
	})

	// Só atualiza o saldo se o arquivo for mais recente que o último importado
	if (
		balance !== null &&
		balanceDate &&
		(!account.balanceDate || balanceDate >= account.balanceDate)
	) {
		await prisma.bankAccount.update({
			where: { id: account.id },
			data: { balance, balanceDate },
		})
	}

	const created = await prisma.transaction.createManyAndReturn({
		data: statement.transactions.map((tx) => ({ ...tx, accountId: account.id })),
		skipDuplicates: true,
		select: { id: true },
	})

	// Regras de tag valem só para as transações novas: uma tag removida à mão não volta
	await applyTagRules({ userId, transactionIds: created.map((tx) => tx.id) })

	// Sobraram sem tag: é o que a pessoa ainda precisa conferir
	const untagged = await prisma.transaction.count({
		where: { id: { in: created.map((tx) => tx.id) }, tags: { none: {} } },
	})

	const imported = created.length
	return { account, imported, duplicates: statement.transactions.length - imported, untagged }
}
