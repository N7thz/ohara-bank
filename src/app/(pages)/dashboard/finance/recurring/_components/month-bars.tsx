import { utc } from '@date-fns/utc'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

// "2026-10" → "out/26"
export function monthLabel(month: string) {
	return format(`${month}-01`, 'MMM/yy', { in: utc, locale: ptBR })
}

interface MonthBarsProps {
	/** Do mais antigo ao atual; null = mês sem pagamento */
	data: { month: string; amount: number | null }[]
	/** Linha tracejada da média */
	average?: number
	/** Mês atual ainda sem pagamento: contorno tracejado na altura do valor esperado */
	estimate?: number
	className?: string
}

/**
 * Uma barra por mês, crescendo da base. Passar o mouse mostra mês e valor; só o primeiro e o
 * último mês têm rótulo no eixo. Mês sem pagamento vira um traço na base
 */
export function MonthBars({ data, average, estimate, className }: MonthBarsProps) {
	const max = Math.max(...data.map((item) => item.amount ?? 0), estimate ?? 0, 1)

	return (
		<div className={cn('flex flex-col gap-1.5', className)}>
			<div className="relative flex h-20 items-end gap-0.5">
				{average !== undefined && average > 0 && (
					<div
						aria-hidden
						className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/50"
						style={{ bottom: `${(average / max) * 100}%` }}
					/>
				)}
				{data.map((item, index) => {
					const isLast = index === data.length - 1
					const projected = isLast && item.amount === null && estimate ? estimate : null
					const text =
						item.amount !== null
							? formatCurrency(item.amount)
							: projected
								? `esperado ~${formatCurrency(projected)}`
								: 'sem pagamento'
					return (
						<div
							key={item.month}
							className="group/bar relative flex h-full max-w-6 flex-1 items-end justify-center"
							role="img"
							aria-label={`${monthLabel(item.month)}: ${text}`}
						>
							{item.amount !== null ? (
								<div
									className="h-full w-full origin-bottom rounded-t-[4px] bg-chart-1 transition-[transform,opacity] duration-500 ease-out group-hover/bar:opacity-80"
									style={{ transform: `scaleY(${item.amount / max})` }}
								/>
							) : projected ? (
								<div
									className="w-full rounded-t-[4px] border-2 border-b-0 border-dashed border-chart-1/70"
									style={{ height: `${(projected / max) * 100}%` }}
								/>
							) : (
								<div className="h-0.5 w-full rounded-full bg-muted-foreground/30" />
							)}
							<div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground opacity-0 shadow-md ring-1 ring-foreground/10 transition-opacity group-hover/bar:opacity-100">
								<span className="text-muted-foreground">{monthLabel(item.month)}</span>{' '}
								<span className="font-medium tabular-nums">{text}</span>
							</div>
						</div>
					)
				})}
			</div>
			<div className="flex justify-between text-xs text-muted-foreground">
				<span>{monthLabel(data[0].month)}</span>
				{data.length > 1 && <span>{monthLabel(data[data.length - 1].month)}</span>}
			</div>
		</div>
	)
}
