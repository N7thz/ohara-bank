'use client'

import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from '@/components/ui/pagination'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'

export const PAGE_SIZE_OPTIONS = [25, 50, 100]

// 1 … 4 5 6 … 12: primeira, última e as vizinhas da atual
function pageList(page: number, totalPages: number): (number | 'gap')[] {
	const pages = new Set([1, totalPages, page - 1, page, page + 1])
	const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)

	const list: (number | 'gap')[] = []
	for (const [index, n] of sorted.entries()) {
		const previous = sorted[index - 1]
		if (previous !== undefined && n - previous === 2) list.push(previous + 1)
		else if (previous !== undefined && n - previous > 2) list.push('gap')
		list.push(n)
	}
	return list
}

interface TablePaginationProps {
	page: number
	pageSize: number
	total: number
	disabled?: boolean
	/** Endereço de cada página, para o link funcionar também com o botão do meio do mouse */
	hrefFor: (page: number) => string
	onPageChange: (page: number) => void
	onPageSizeChange: (pageSize: number) => void
}

export function TablePagination({
	page,
	pageSize,
	total,
	disabled,
	hrefFor,
	onPageChange,
	onPageSizeChange,
}: TablePaginationProps) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize))
	const first = total === 0 ? 0 : (page - 1) * pageSize + 1
	const last = Math.min(page * pageSize, total)

	function go(target: number) {
		return (event: React.MouseEvent) => {
			event.preventDefault()
			if (!disabled && target >= 1 && target <= totalPages && target !== page) onPageChange(target)
		}
	}

	const sizeItems = PAGE_SIZE_OPTIONS.map((size) => ({
		value: String(size),
		label: `${size} por página`,
	}))

	return (
		<div className="flex flex-col items-center gap-3 text-sm text-muted-foreground sm:flex-row sm:justify-between">
			<div className="flex items-center gap-3">
				<span className="tabular-nums">
					{first}–{last} de {total}
				</span>
				<Select
					items={sizeItems}
					value={String(pageSize)}
					onValueChange={(value) => value && onPageSizeChange(Number(value))}
				>
					<SelectTrigger size="sm" aria-label="Transações por página">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{sizeItems.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			</div>

			{totalPages > 1 && (
				<Pagination aria-label="Paginação" className="mx-0 w-auto">
					<PaginationContent>
						<PaginationItem>
							<PaginationPrevious
								text="Anterior"
								aria-label="Página anterior"
								href={hrefFor(Math.max(1, page - 1))}
								aria-disabled={page <= 1}
								className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
								onClick={go(page - 1)}
							/>
						</PaginationItem>
						{pageList(page, totalPages).map((item, index) =>
							item === 'gap' ? (
								// biome-ignore lint/suspicious/noArrayIndexKey: reticências não têm id próprio
								<PaginationItem key={`gap-${index}`} className="hidden sm:block">
									<PaginationEllipsis />
								</PaginationItem>
							) : (
								<PaginationItem
									key={item}
									className={item === page ? undefined : 'hidden sm:block'}
								>
									<PaginationLink
										href={hrefFor(item)}
										isActive={item === page}
										aria-label={`Página ${item}`}
										onClick={go(item)}
									>
										{item}
									</PaginationLink>
								</PaginationItem>
							),
						)}
						<PaginationItem>
							<PaginationNext
								text="Próxima"
								aria-label="Próxima página"
								href={hrefFor(Math.min(totalPages, page + 1))}
								aria-disabled={page >= totalPages}
								className={page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
								onClick={go(page + 1)}
							/>
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			)}
		</div>
	)
}
