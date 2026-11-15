import { subtract, toMoney, toReais } from '@/lib/money'
import { CtaButton, EmailLayout, ItemList, Money } from './components/email-layout'

const difference = (a: number, b: number) => toReais(subtract(toMoney(a), toMoney(b)))

// Tags que passaram de 80% ou de 100% do orçamento do mês

export interface BudgetAlertProps {
	title: string
	alerts: { tagId: string; name: string; spent: number; budget: number; level: 80 | 100 }[]
}

export default function BudgetAlert({ title, alerts }: BudgetAlertProps) {
	return (
		<EmailLayout title={title} preview={alerts.map((alert) => alert.name).join(', ')}>
			<ItemList
				items={alerts.map((alert) => ({
					key: alert.tagId,
					label: alert.name,
					note:
						alert.level === 100 ? (
							<span className="text-bad">
								<Money value={difference(alert.spent, alert.budget)} /> acima do limite
							</span>
						) : (
							<>
								<Money value={difference(alert.budget, alert.spent)} /> livres
							</>
						),
					value: (
						<>
							<Money value={alert.spent} /> <span className="text-muted">de</span>{' '}
							<span className="text-muted">
								<Money value={alert.budget} />
							</span>
						</>
					),
				}))}
			/>
			<CtaButton path="/dashboard">Ver orçamentos</CtaButton>
		</EmailLayout>
	)
}

BudgetAlert.PreviewProps = {
	title: '2 orçamentos perto do limite',
	alerts: [
		{ tagId: '1', name: 'Transporte', spent: 55.75, budget: 40, level: 100 },
		{ tagId: '2', name: 'Mercado', spent: 340, budget: 400, level: 80 },
	],
} satisfies BudgetAlertProps
