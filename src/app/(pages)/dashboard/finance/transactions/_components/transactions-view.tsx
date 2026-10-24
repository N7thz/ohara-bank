'use client'

import { useQueryClient } from '@tanstack/react-query'
import { format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ReceiptIcon, SearchIcon, XIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { HeroMetric } from '@/components/finance/hero-metric'
import { IncomeExpenseChart } from '@/components/finance/income-expense-chart'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useBankAccounts } from '@/hooks/finance/accounts'
import { useTags } from '@/hooks/finance/tags'
import type { TransactionFilters } from '@/hooks/finance/transactions'
import { transactionsQuery, useTransactions } from '@/hooks/finance/transactions'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SpendingByTag, UNTAGGED } from './spending-by-tag'
import { PAGE_SIZE_OPTIONS, TablePagination } from './table-pagination'
import { TagManagerSheet } from './tag-manager-sheet'
import { TransactionTagsCell } from './transaction-tags-cell'

const ALL = 'all'
const DEFAULT_PAGE_SIZE = 50

// 2026-09 → setembro de 2026
function formatMonth(month: string) {
	return format(parse(month, 'yyyy-MM', new Date()), "MMMM 'de' yyyy", { locale: ptBR })
}

type Param = 'accountId' | 'month' | 'type' | 'tagId' | 'q' | 'page' | 'pageSize'

/**
 * Filtros e página ficam na URL: voltar no navegador, recarregar ou compartilhar o
 * link abre a mesma visão, e cada combinação fica no cache do React Query
 */
function useTransactionParams() {
	const searchParams = useSearchParams()
	const router = useRouter()
	const pathname = usePathname()

	const pageSize = Number(searchParams.get('pageSize'))
	const params = {
		accountId: searchParams.get('accountId') ?? ALL,
		month: searchParams.get('month') ?? ALL,
		type: searchParams.get('type') ?? ALL,
		tagId: searchParams.get('tagId') ?? ALL,
		q: searchParams.get('q') ?? '',
		page: Math.max(1, Number(searchParams.get('page')) || 1),
		pageSize: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
	}

	function hrefWith(patch: Partial<Record<Param, string | number>>) {
		const next = new URLSearchParams(searchParams)
		for (const [key, value] of Object.entries(patch)) {
			// Valores padrão saem da URL para o endereço ficar curto
			const isDefault =
				value === ALL ||
				value === '' ||
				(key === 'page' && value === 1) ||
				(key === 'pageSize' && value === DEFAULT_PAGE_SIZE)
			if (isDefault) next.delete(key)
			else next.set(key, String(value))
		}
		const query = next.toString()
		return query ? `${pathname}?${query}` : pathname
	}

	/** Filtro novo volta para a página 1 e substitui a entrada do histórico */
	function setFilter(patch: Partial<Record<Exclude<Param, 'page'>, string | number>>) {
		router.replace(hrefWith({ ...patch, page: 1 }), { scroll: false })
	}

	/** Troca de página entra no histórico: o botão voltar volta à página anterior */
	function setPage(page: number) {
		router.push(hrefWith({ page }), { scroll: false })
	}

	return { params, hrefWith, setFilter, setPage }
}

export function TransactionsView() {
	const queryClient = useQueryClient()
	const { params, hrefWith, setFilter, setPage } = useTransactionParams()
	const { accountId, month, type, tagId, q, page, pageSize } = params
	const tableRef = useRef<HTMLDivElement>(null)

	// A busca digitada só vai para a URL quando a pessoa para de digitar
	const [search, setSearch] = useState(q)
	const setFilterRef = useRef(setFilter)
	setFilterRef.current = setFilter
	useEffect(() => {
		if (search.trim() === q) return
		const timeout = setTimeout(() => setFilterRef.current({ q: search.trim() }), 300)
		return () => clearTimeout(timeout)
	}, [search, q])
	// Voltar no navegador muda a URL: o campo acompanha
	useEffect(() => setSearch(q), [q])

	const filters: TransactionFilters = {
		page,
		...(pageSize !== DEFAULT_PAGE_SIZE && { pageSize }),
		...(accountId !== ALL && { accountId }),
		...(month !== ALL && { month }),
		...(type !== ALL && { type: type as TransactionFilters['type'] }),
		...(q && { q }),
		...(tagId !== ALL && { tagId }),
	}

	const { data: accounts = [] } = useBankAccounts()
	const { data: tags = [] } = useTags()
	const { data, isLoading, isError, isPlaceholderData } = useTransactions(filters)

	const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

	// Pré-carrega a próxima página: avançar abre na hora
	useEffect(() => {
		if (!data || isPlaceholderData || page >= totalPages) return
		queryClient.prefetchQuery(transactionsQuery({ ...filters, page: page + 1 }))
	})

	function changePage(next: number) {
		setPage(next)
		tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	const accountItems = [
		{ value: ALL, label: 'Todas as contas' },
		...accounts.map((account) => ({
			value: account.id,
			label: `${account.bankName} · ${account.number}`,
		})),
	]
	const monthItems = [
		{ value: ALL, label: 'Todo o período' },
		...(data?.months ?? []).map((value) => ({ value, label: formatMonth(value) })),
	]
	// Só as tags que têm transação com a conta, o período e a busca atuais; a escolhida
	// fica mesmo sem transação, para dar para desmarcar
	const tagCounts = data?.tagCounts ?? {}
	const tagItems = [
		{ value: ALL, label: 'Todas as tags' },
		{ value: UNTAGGED, label: 'Sem tag' },
		...tags
			.filter((tag) => (tagCounts[tag.id] ?? 0) > 0 || tag.id === tagId)
			.map((tag) => ({ value: tag.id, label: `${tag.name} (${tagCounts[tag.id] ?? 0})` })),
	]

	const balance = data ? data.summary.income + data.summary.expense : 0
	// Transações com essas tags aparecem na lista, mas não contam nos totais
	const excludedTagIds = tags.filter((tag) => tag.excludeFromTotals).map((tag) => tag.id)
	const isExcluded = (tagIds: string[]) => excludedTagIds.some((id) => tagIds.includes(id))

	// Filtros ligados, como chips que dá para remover um a um
	const account = accounts.find((item) => item.id === accountId)
	const activeFilters = [
		account && { key: 'accountId', label: `${account.bankName} · ${account.number}` },
		month !== ALL && { key: 'month', label: formatMonth(month) },
		tagId !== ALL && {
			key: 'tagId',
			label: tagId === UNTAGGED ? 'Sem tag' : (tags.find((tag) => tag.id === tagId)?.name ?? 'Tag'),
		},
		type !== ALL && { key: 'type', label: type === 'income' ? 'Só entradas' : 'Só saídas' },
		q && { key: 'q', label: `"${q}"` },
	].filter((item): item is { key: Exclude<Param, 'page' | 'pageSize'>; label: string } => !!item)

	function removeFilter(key: Exclude<Param, 'page' | 'pageSize'>) {
		if (key === 'q') setSearch('')
		setFilter({ [key]: key === 'q' ? '' : ALL })
	}

	function clearFilters() {
		setSearch('')
		setFilter({ accountId: ALL, month: ALL, tagId: ALL, type: ALL, q: '' })
	}

	return (
		<div className="stagger page-stack">
			<PageHeader
				title="Transações"
				description="Todas as contas importadas. Os filtros e a página ficam no endereço."
				actions={<TagManagerSheet />}
				aside={
					<HeroMetric
						label="Saldo"
						value={data ? balance : undefined}
						className={!data ? '' : balance >= 0 ? 'text-green-600' : 'text-red-500'}
						items={
							data && [
								{ label: 'Entradas', value: data.summary.income, className: 'text-green-600' },
								{
									label: 'Saídas',
									value: Math.abs(data.summary.expense),
									className: 'text-red-500',
								},
							]
						}
						footnote={
							data &&
							`Com conta, mês, tag e busca; o filtro Entradas/Saídas só muda a lista.${
								data.summary.excludedCount > 0
									? ` ${data.summary.excludedCount} ${
											data.summary.excludedCount === 1
												? 'transferência entre contas ficou fora dos totais.'
												: 'transferências entre contas ficaram fora dos totais.'
										}`
									: ''
							}`
						}
					/>
				}
			/>

			{/* A barra de filtros fica fixa enquanto as seções abaixo rolam */}
			<div className="flex flex-col gap-8">
				{/* Filtros fixos no topo enquanto rola: valem para tudo que está abaixo */}
				<div className="sticky top-12 z-10 -mx-6 flex flex-col gap-2 border-b bg-background/95 px-6 py-3 backdrop-blur">
					<div className="flex flex-wrap items-center gap-2">
						<Select
							items={accountItems}
							value={accountId}
							// Os meses dependem da conta: trocar de conta volta para todo o período
							onValueChange={(value) => setFilter({ accountId: value ?? ALL, month: ALL })}
						>
							<SelectTrigger className="min-w-48" aria-label="Conta">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{accountItems.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>

						<Select
							items={monthItems}
							value={month}
							onValueChange={(value) => setFilter({ month: value ?? ALL })}
						>
							<SelectTrigger className="min-w-44" aria-label="Mês">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{monthItems.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>

						<Select
							items={tagItems}
							value={tagId}
							onValueChange={(value) => setFilter({ tagId: value ?? ALL })}
						>
							<SelectTrigger className="min-w-40" aria-label="Tag">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{tagItems.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>

						<ToggleGroup
							variant="outline"
							spacing={0}
							value={[type]}
							onValueChange={(values) => setFilter({ type: values[0] ?? ALL })}
						>
							<ToggleGroupItem value={ALL}>Todas</ToggleGroupItem>
							<ToggleGroupItem value="income">Entradas</ToggleGroupItem>
							<ToggleGroupItem value="expense">Saídas</ToggleGroupItem>
						</ToggleGroup>

						<InputGroup className="sm:ml-auto sm:max-w-64">
							<InputGroupInput
								placeholder="Buscar descrição"
								aria-label="Buscar descrição"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
							/>
							<InputGroupAddon>
								<SearchIcon />
							</InputGroupAddon>
						</InputGroup>
					</div>

					<div className="flex min-h-7 flex-wrap items-center gap-2 text-sm">
						<span className="text-muted-foreground">
							{data
								? `${data.total} ${data.total === 1 ? 'transação' : 'transações'}`
								: 'Carregando...'}
						</span>
						{activeFilters.map((filter) => (
							<Button
								key={filter.key}
								variant="secondary"
								size="xs"
								aria-label={`Remover filtro ${filter.label}`}
								onClick={() => removeFilter(filter.key)}
							>
								{filter.label}
								<XIcon />
							</Button>
						))}
						{activeFilters.length > 1 && (
							<Button variant="link" size="xs" onClick={clearFilters}>
								Limpar filtros
							</Button>
						)}
					</div>
				</div>

				<div className="section-stack">
					{data && (
						<PageSection
							title="Evolução"
							description="O gráfico mostra todos os meses; os gastos por tag ignoram o filtro de tag."
						>
							<div className="grid gap-6 md:grid-cols-[3fr_2fr]">
								{/* Resposta em cache de antes do byMonth existir não tem o campo */}
								{data.byMonth?.length ? (
									<IncomeExpenseChart
										granularity="month"
										periods={data.byMonth}
										selectedStart={month === ALL ? null : `${month}-01`}
										description="Todos os meses, com conta, tag e busca. Clique numa coluna para filtrar o mês."
										// Clicar no mês já selecionado volta para todo o período
										onSelect={(start) => {
											const clicked = start.slice(0, 7)
											setFilter({ month: clicked === month ? ALL : clicked })
										}}
									/>
								) : null}
								{(data.byTag.length > 0 || data.untagged.count > 0) && (
									<SpendingByTag
										tags={tags}
										byTag={data.byTag}
										untagged={data.untagged}
										activeTagId={tagId === ALL ? null : tagId}
										onSelect={(id) => setFilter({ tagId: id ?? ALL })}
									/>
								)}
							</div>
						</PageSection>
					)}

					<PageSection
						title="Lançamentos"
						description={data && `Página ${data.page} de ${totalPages}`}
						className="reveal"
					>
						{isError && <p className="text-sm text-destructive">Erro ao carregar transações.</p>}

						{isLoading && (
							<div className="flex flex-col gap-2">
								{['a', 'b', 'c', 'd', 'e'].map((key) => (
									<Skeleton key={key} className="h-10 w-full" />
								))}
							</div>
						)}

						{data && data.transactions.length === 0 && (
							<Empty className="border">
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<ReceiptIcon />
									</EmptyMedia>
									<EmptyTitle>Nenhuma transação encontrada</EmptyTitle>
									<EmptyDescription>
										Mude os filtros ou importe um extrato na página de Finanças.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						)}

						{data && data.transactions.length > 0 && (
							<div
								ref={tableRef}
								className={cn(
									'flex scroll-mt-40 flex-col gap-3',
									isPlaceholderData && 'opacity-60',
								)}
							>
								<div className="rounded-lg border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead className="w-28 pl-4">Data</TableHead>
												<TableHead>Descrição</TableHead>
												<TableHead className="hidden sm:table-cell">Tags</TableHead>
												<TableHead className="hidden md:table-cell">Conta</TableHead>
												<TableHead className="pr-4 text-right">Valor</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{data.transactions.map((tx) => (
												<TableRow key={tx.id}>
													<TableCell className="pl-4 align-top text-muted-foreground tabular-nums">
														{formatDate(tx.date)}
													</TableCell>
													<TableCell className="w-full max-w-0">
														<span className="block truncate" title={tx.description}>
															{tx.description}
														</span>
														{tx.installment && (
															<span className="mt-0.5 block truncate text-xs text-muted-foreground">
																{tx.installment.debtName} · parcela {tx.installment.number} de{' '}
																{tx.installment.total}
															</span>
														)}
														{/* No celular as tags vêm embaixo da descrição */}
														<div className="mt-1 sm:hidden">
															<TransactionTagsCell
																transactionId={tx.id}
																tagIds={tx.tagIds}
																tags={tags}
															/>
														</div>
													</TableCell>
													<TableCell className="hidden sm:table-cell">
														<TransactionTagsCell
															transactionId={tx.id}
															tagIds={tx.tagIds}
															tags={tags}
														/>
													</TableCell>
													<TableCell className="hidden text-muted-foreground md:table-cell">
														{tx.account.bankName}
													</TableCell>
													<TableCell
														title={
															isExcluded(tx.tagIds)
																? 'Fora dos totais (transferência entre contas)'
																: undefined
														}
														className={cn(
															'pr-4 text-right align-top font-medium tabular-nums',
															isExcluded(tx.tagIds)
																? 'text-muted-foreground'
																: tx.amount >= 0
																	? 'text-green-600'
																	: 'text-red-500',
														)}
													>
														{tx.amount >= 0 ? '+' : '-'}
														{formatCurrency(Math.abs(tx.amount))}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>

								<TablePagination
									page={page}
									pageSize={data.pageSize}
									total={data.total}
									disabled={isPlaceholderData}
									hrefFor={(target) => hrefWith({ page: target })}
									onPageChange={changePage}
									onPageSizeChange={(size) => setFilter({ pageSize: size })}
								/>
							</div>
						)}
					</PageSection>
				</div>
			</div>
		</div>
	)
}
