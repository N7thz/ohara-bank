import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

interface MetricItem {
	label: string
	value: number
	className?: string
	hint?: React.ReactNode
}

interface HeroMetricProps {
	label: string
	/** undefined mostra o skeleton enquanto carrega */
	value: number | undefined
	className?: string
	hint?: React.ReactNode
	/** Números secundários, abaixo do principal */
	items?: MetricItem[]
	footnote?: React.ReactNode
}

/** Lado direito do hero: um número em destaque e os de apoio embaixo */
export function HeroMetric({ label, value, className, hint, items, footnote }: HeroMetricProps) {
	return (
		<Card>
			<CardContent className="flex flex-col gap-5">
				<div className="flex flex-col gap-1">
					<span className="text-sm font-medium text-muted-foreground">{label}</span>
					{value === undefined ? (
						<Skeleton className="h-12 w-48" />
					) : (
						<span
							className={cn(
								'text-[clamp(2rem,4vw,3rem)] leading-tight font-bold tracking-tight tabular-nums',
								className,
							)}
						>
							{formatCurrency(value)}
						</span>
					)}
					{hint && <span className="text-xs text-muted-foreground">{hint}</span>}
				</div>

				{items && items.length > 0 && (
					<dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4">
						{items.map((item) => (
							<div key={item.label} className="flex min-w-0 flex-col gap-0.5">
								<dt className="text-xs text-muted-foreground">{item.label}</dt>
								<dd className={cn('text-lg font-semibold tabular-nums', item.className)}>
									{formatCurrency(item.value)}
								</dd>
								{item.hint && <dd className="text-xs text-muted-foreground">{item.hint}</dd>}
							</div>
						))}
					</dl>
				)}

				{footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
			</CardContent>
		</Card>
	)
}
