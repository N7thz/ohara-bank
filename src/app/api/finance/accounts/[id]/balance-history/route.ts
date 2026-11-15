import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-session'
import { prisma } from '@/lib/prisma'

const DAY_MS = 86_400_000

const dayKey = (date: Date) => date.toISOString().slice(0, 10)

// Saldo no fim de cada dia, reconstruído a partir do saldo do último extrato.
// Todas as transações entram, inclusive as "fora dos totais": transferência
// entre contas próprias muda o saldo de verdade
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	const { id } = await params
	const account = await prisma.bankAccount.findUnique({ where: { id } })

	if (!account || account.userId !== session.user.id) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}

	// Sem saldo (cartão de crédito) não há de onde partir
	if (account.balance === null || !account.balanceDate) {
		return NextResponse.json([])
	}

	const transactions = await prisma.transaction.findMany({
		where: { accountId: id },
		select: { date: true, amount: true },
		orderBy: { date: 'asc' },
	})

	const balance = Number(account.balance)
	const anchorDay = dayKey(account.balanceDate)

	// Movimento líquido de cada dia, em centavos para não acumular erro de ponto flutuante
	const netByDay = new Map<string, number>()
	for (const tx of transactions) {
		const key = dayKey(tx.date)
		netByDay.set(key, (netByDay.get(key) ?? 0) + Math.round(Number(tx.amount) * 100))
	}

	const movementDays = [...netByDay.keys()].sort()
	if (movementDays.length === 0) {
		return NextResponse.json([{ date: anchorDay, balance }])
	}

	const lastMovement = movementDays[movementDays.length - 1] as string
	const lastDay = lastMovement > anchorDay ? lastMovement : anchorDay
	const lastDate = new Date(`${lastDay}T00:00:00Z`)
	const windowStart = dayKey(new Date(lastDate.getTime() - 365 * DAY_MS))
	const firstDay = (movementDays[0] as string) > windowStart ? movementDays[0] : windowStart

	// Soma acumulada do movimento até cada dia com movimento
	const cumulative = new Map<string, number>()
	let running = 0
	for (const day of movementDays) {
		running += netByDay.get(day) ?? 0
		cumulative.set(day, running)
	}
	const cumulativeUntil = (day: string) => {
		let total = 0
		for (const key of movementDays) {
			if (key > day) break
			total = cumulative.get(key) ?? total
		}
		return total
	}

	// saldo(dia) = saldo do extrato − movimento depois do dia (até a data do extrato);
	// depois da data do extrato a conta é a mesma, com sinal trocado
	const anchorCumulative = cumulativeUntil(anchorDay)
	const balanceAt = (day: string) => balance + (cumulativeUntil(day) - anchorCumulative) / 100

	const days = new Set([firstDay, lastDay])
	for (const day of movementDays) {
		if (day >= firstDay) days.add(day)
	}

	const history = [...days]
		.sort()
		.map((date) => ({ date, balance: Math.round(balanceAt(date) * 100) / 100 }))

	return NextResponse.json(history)
}
