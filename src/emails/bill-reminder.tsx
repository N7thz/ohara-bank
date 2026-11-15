import { formatCurrency, formatDate } from '@/lib/format'
import { sumMoney, toMoney, toReais } from '@/lib/money'
import {
	CtaButton,
	EmailLayout,
	ItemList,
	Money,
	Muted,
	SectionTitle,
} from './components/email-layout'

// Contas fixas, recorrentes e parceladas atrasadas ou vencendo nos próximos dias

export interface BillReminderProps {
	title: string
	late: { id: string; name: string; remaining: number; dueDay: number }[]
	soon: { id: string; name: string; remaining: number; dueDay: number; inDays: number }[]
	/** Data do extrato mais recente (AAAA-MM-DD) */
	importedUntil: string | null
}

export const dueLabel = (inDays: number) =>
	inDays === 0 ? 'vence hoje' : inDays === 1 ? 'vence amanhã' : `vence em ${inDays} dias`

export default function BillReminder({ title, late, soon, importedUntil }: BillReminderProps) {
	const total = toReais(sumMoney([...late, ...soon].map((bill) => toMoney(bill.remaining))))

	return (
		<EmailLayout title={title} preview={`Total de ${formatCurrency(total)} a pagar`}>
			{late.length > 0 && (
				<>
					<SectionTitle>Atrasadas</SectionTitle>
					<ItemList
						items={late.map((bill) => ({
							key: bill.id,
							label: bill.name,
							note: <span className="text-bad">venceu dia {bill.dueDay}</span>,
							value: <Money value={bill.remaining} />,
						}))}
					/>
				</>
			)}

			{soon.length > 0 && (
				<>
					<SectionTitle>Vencendo</SectionTitle>
					<ItemList
						items={soon.map((bill) => ({
							key: bill.id,
							label: bill.name,
							note: `${dueLabel(bill.inDays)} · dia ${bill.dueDay}`,
							value: <Money value={bill.remaining} />,
						}))}
					/>
				</>
			)}

			{importedUntil && (
				<Muted>
					Situação pelos extratos importados até {formatDate(importedUntil)}. Se já pagou, marque
					como paga em Dívidas.
				</Muted>
			)}

			<CtaButton path="/dashboard/finance/debts">Ver dívidas</CtaButton>
		</EmailLayout>
	)
}

BillReminder.PreviewProps = {
	title: '2 contas atrasadas e 1 vencendo',
	late: [
		{ id: '1', name: 'Internet (Giga Mais)', remaining: 129.99, dueDay: 5 },
		{ id: '2', name: 'Celular', remaining: 120, dueDay: 5 },
	],
	soon: [{ id: '3', name: 'Luz (Enel)', remaining: 320, dueDay: 28, inDays: 2 }],
	importedUntil: '2026-10-25',
} satisfies BillReminderProps
