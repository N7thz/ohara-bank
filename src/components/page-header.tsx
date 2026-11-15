interface PageHeaderProps {
	/** Contexto do que a página mostra (ex.: o período), logo abaixo do título */
	eyebrow?: string
	title: string
	description?: string
	/** Botões abaixo do texto */
	actions?: React.ReactNode
	/** Filtros e avisos abaixo da descrição */
	children?: React.ReactNode
	/** Lado direito: o número principal da página */
	aside?: React.ReactNode
}

/**
 * Cabeçalho da página: título de app (não de landing page), o contexto e os filtros à
 * esquerda e o número principal à direita; empilha abaixo de 768px. O número é o que
 * tem o maior tamanho da página, não o título
 */
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
				aside ? 'grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-end' : ''
			}
		>
			<div className="flex min-w-0 flex-col gap-4">
				<div className="flex flex-col gap-1.5">
					<h1 className="text-[clamp(1.75rem,3vw,2.25rem)] leading-tight font-semibold tracking-tight text-balance">
						{title}
					</h1>
					{eyebrow && <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>}
					{description && (
						<p className="max-w-[72ch] text-sm text-muted-foreground">{description}</p>
					)}
				</div>
				{children}
				{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
			</div>
			{aside}
		</header>
	)
}
