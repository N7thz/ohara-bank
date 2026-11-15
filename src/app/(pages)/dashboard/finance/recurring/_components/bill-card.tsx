import { CheckIcon, CircleAlertIcon, ClockIcon, MoonIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { TrackedBill } from '@/hooks/finance/recurring'
import { formatCurrency, formatDate } from '@/lib/format'
import { MonthBars, monthLabel } from './month-bars'

// Um ano no gráfico: dá para ver a luz subir no verão
const CHART_MONTHS = 12

/** Situação no mês atual, sempre com ícone e texto (a cor só reforça) */
function BillStatus({ bill, today }: { bill: TrackedBill; today: string }) {
	if (!bill.active) {
		const last = bill.lastPayment?.date.slice(0, 7)
		return (
			<span className="flex items-center gap-1 text-xs text-muted-foreground">
				<MoonIcon className="size-3.5" />
				{last ? `Sem pagamento desde ${monthLabel(last)}` : 'Nenhum pagamento achado'}
			</span>
		)
	}
	if (bill.paidThisMonth > 0) {
		return (
			<span className="flex items-center gap-1 text-xs font-medium text-positive">
				<CheckIcon className="size-3.5" />
				Paga {formatCurrency(bill.paidThisMonth)}
			</span>
		)
	}
	const late = today > bill.nextDue
	return (
		<span
			className={
				late
					? 'flex items-center gap-1 text-xs font-medium text-warning'
					: 'flex items-center gap-1 text-xs text-muted-foreground'
			}
		>
			{late ? <CircleAlertIcon className="size-3.5" /> : <ClockIcon className="size-3.5" />}
			{late ? 'Não achada este mês' : `Vence por volta do dia ${Number(bill.nextDue.slice(8))}`}
		</span>
	)
}

/** Gastar mais é ruim: alta em vermelho, queda em verde */
function Trend({ trend }: { trend: number | null }) {
	if (trend === null || Math.abs(trend) < 0.01) return null
	const percent = Math.round(Math.abs(trend) * 100)
	return (
		<span className={trend > 0 ? 'text-negative' : 'text-positive'}>
			{trend > 0 ? '▲' : '▼'} {percent}% vs. média
		</span>
	)
}

export function BillCard({ bill, today }: { bill: TrackedBill; today: string }) {
	const chart = bill.monthly.slice(-CHART_MONTHS)
	const pending = bill.active && bill.paidThisMonth === 0

	return (
		<Card>
			<CardContent className="flex flex-col gap-5">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 flex-col gap-1">
						<span className="truncate font-semibold" title={bill.name}>
							{bill.name}
						</span>
						<BillStatus bill={bill} today={today} />
					</div>
					<div className="flex shrink-0 flex-col items-end">
						<span className="text-xs text-muted-foreground">Próxima, estimada</span>
						<span className="text-2xl font-bold tracking-tight tabular-nums">
							~{formatCurrency(bill.estimate)}
						</span>
					</div>
				</div>

				{bill.count > 0 ? (
					<MonthBars
						data={chart}
						average={bill.average}
						estimate={pending ? bill.estimate : undefined}
					/>
				) : (
					<p className="text-sm text-muted-foreground">
						Nenhum pagamento achado no extrato com o padrão desta dívida.
					</p>
				)}

				{bill.count > 0 && (
					<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
						<div className="flex flex-col">
							<dt className="text-muted-foreground">Média por mês</dt>
							<dd className="font-medium tabular-nums">{formatCurrency(bill.average)}</dd>
						</div>
						<div className="flex flex-col">
							<dt className="text-muted-foreground">Menor e maior</dt>
							<dd className="font-medium tabular-nums">
								{formatCurrency(bill.min)} a {formatCurrency(bill.max)}
							</dd>
						</div>
						{bill.lastPayment && (
							<div className="col-span-2 flex flex-wrap items-baseline gap-x-2">
								<dt className="text-muted-foreground">Último</dt>
								<dd className="flex flex-wrap gap-x-2 tabular-nums">
									<span className="font-medium">{formatCurrency(bill.lastPayment.amount)}</span>
									<span className="text-muted-foreground">
										em {formatDate(bill.lastPayment.date)}
									</span>
									<Trend trend={bill.trend} />
								</dd>
							</div>
						)}
					</dl>
				)}
			</CardContent>
		</Card>
	)
}
