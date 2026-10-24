import { cn } from '@/lib/utils'

interface PageSectionProps {
	title: string
	description?: React.ReactNode
	/** Botões à direita do título */
	actions?: React.ReactNode
	className?: string
	children: React.ReactNode
}

/** Seção da página com título H2 (1,5rem); o espaço entre seções vem de .section-stack */
export function PageSection({
	title,
	description,
	actions,
	className,
	children,
}: PageSectionProps) {
	return (
		<section className={cn('flex flex-col gap-6', className)}>
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
					{description && <p className="text-sm text-muted-foreground">{description}</p>}
				</div>
				{actions}
			</div>
			{children}
		</section>
	)
}
