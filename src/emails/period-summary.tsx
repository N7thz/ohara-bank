import { formatCurrency } from '@/lib/format'
import { subtract, toMoney, toReais } from '@/lib/money'
import {
	CtaButton,
	Delta,
	EmailLayout,
	ItemList,
	Metrics,
	Money,
	Muted,
	SectionTitle,
} from './components/email-layout'

// Resumo semanal e mensal: entradas, saídas, onde mais gastou e gastos por tag

/** Números do período (src/lib/email/reports.ts) */
export interface PeriodReport {
	income: number
	/** Positivo */
	expense: number
	count: number
	topTags: { name: string; total: number }[]
	topMerchants: { name: string; total: number; count: number }[]
}

export interface PeriodSummaryProps {
	title: string
	/** "semana" ou "mês": vai na linha de prévia */
	unit: 'semana' | 'mês'
	report: PeriodReport
	/** Período anterior, para as setas; sem transações, fica de fora */
	previous?: Pick<PeriodReport, 'income' | 'expense'>
	/** "a semana anterior", "o mês anterior" */
	previousLabel: string
}

export default function PeriodSummary({
	title,
	unit,
	report,
	previous,
	previousLabel,
}: PeriodSummaryProps) {
	const balance = toReais(subtract(toMoney(report.income), toMoney(report.expense)))

	return (
		<EmailLayout
			title={title}
			preview={`Saídas de ${formatCurrency(report.expense)} e saldo de ${formatCurrency(balance)} ${unit === 'semana' ? 'na semana' : 'no mês'}`}
		>
			<Metrics
				items={[
					{
						label: 'Entradas',
						value: <Money value={report.income} />,
						hint: <Delta value={report.income} previous={previous?.income} upIsGood />,
					},
					{
						label: 'Saídas',
						value: <Money value={report.expense} />,
						hint: <Delta value={report.expense} previous={previous?.expense} upIsGood={false} />,
					},
					{
						label: 'Saldo',
						value: <Money value={balance} tone={balance >= 0 ? 'good' : 'bad'} />,
					},
				]}
			/>
			{previous && <Muted>Setas comparam com {previousLabel}.</Muted>}

			{report.topMerchants.length > 0 && (
				<>
					<SectionTitle>Onde mais gastou</SectionTitle>
					<ItemList
						items={report.topMerchants.map((merchant) => ({
							key: merchant.name,
							label: merchant.name,
							note: `${merchant.count} ${merchant.count === 1 ? 'compra' : 'compras'}`,
							value: <Money value={merchant.total} />,
						}))}
					/>
				</>
			)}

			{report.topTags.length > 0 && (
				<>
					<SectionTitle>Por tag</SectionTitle>
					<ItemList
						items={report.topTags.map((tag) => ({
							key: tag.name,
							label: tag.name,
							value: <Money value={tag.total} />,
						}))}
					/>
				</>
			)}

			<CtaButton path="/dashboard">Abrir o resumo</CtaButton>
		</EmailLayout>
	)
}

PeriodSummary.PreviewProps = {
	title: 'Resumo da semana: 19/10 a 25/10/2026',
	unit: 'semana',
	report: {
		income: 278.98,
		expense: 385.15,
		count: 31,
		topMerchants: [
			{ name: 'Phelipe Klein da Silva', total: 80, count: 2 },
			{ name: 'Empresa Brasileira De Correios E Telegrafos', total: 43, count: 1 },
			{ name: 'Tabacaria Salve Jorg', total: 40, count: 3 },
		],
		topTags: [
			{ name: 'Dívidas com pessoas', total: 134 },
			{ name: 'Transporte', total: 21.36 },
		],
	},
	previous: { income: 1335.16, expense: 412.9 },
	previousLabel: 'a semana anterior',
} satisfies PeriodSummaryProps
