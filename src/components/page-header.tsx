interface PageHeaderProps {
	/** Rótulo pequeno em caixa alta acima do título (ex.: período) */
	eyebrow?: string
	title: string
	description?: string
	/** Botões abaixo do texto */
	actions?: React.ReactNode
	/** Filtros e avisos abaixo da descrição */
	children?: React.ReactNode
	/** Lado direito do hero: o número principal da página */
	aside?: React.ReactNode
}

/** Hero dividido (DESIGN.md): texto à esquerda, visual à direita; empilha abaixo de 768px */
export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
	children,
	aside,
}: PageHeaderProps) {
	return (
		<header
			className={
				aside ? 'grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-end' : ''
			}
		>
			<div className="flex min-w-0 flex-col gap-4">
				<div className="flex flex-col gap-3">
					{eyebrow && (
						<p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
							{eyebrow}
						</p>
					)}
					<h1 className="text-[clamp(2.5rem,5vw,4rem)] leading-[1.05] font-bold tracking-tight">
						{title}
					</h1>
					{description && <p className="max-w-[72ch] text-muted-foreground">{description}</p>}
				</div>
				{children}
				{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
			</div>
			{aside}
		</header>
	)
}
