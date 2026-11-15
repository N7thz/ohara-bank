'use client'

import { useQueryClient } from '@tanstack/react-query'
import { format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DownloadIcon, ReceiptIcon, SearchIcon, XIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { HeroMetric } from '@/components/finance/hero-metric'
import { IncomeExpenseChart } from '@/components/finance/income-expense-chart'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { QueryError } from '@/components/query-error'
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
import {
	transactionsQuery,
	useDailySpending,
	useTransactions,
	useTransactionsOverview,
} from '@/hooks/finance/transactions'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SpendingByTag, UNTAGGED } from './spending-by-tag'
import { SpendingHeatmap } from './spending-heatmap'
import { PAGE_SIZE_OPTIONS, TablePagination } from './table-pagination'
import { TagManagerSheet } from './tag-manager-sheet'
import { TransactionTagsCell } from './transaction-tags-cell'
import { WeekdaySpending } from './weekday-spending'

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

	// Filtros sem a página: a chave do resumo não muda ao trocar de página
	const { page: _page, pageSize: _pageSize, ...overviewFilters } = filters

	// Mesmos filtros, sem paginação
	const exportHref = `/api/finance/transactions/export?${new URLSearchParams(
		Object.entries(filters)
			.filter(([key]) => key !== 'page' && key !== 'pageSize')
			.map(([key, value]) => [key, String(value)]),
	)}`

	const { data: accounts = [] } = useBankAccounts()
	const { data: tags = [] } = useTags()
	const { data, isLoading, isError, isPlaceholderData, refetch, isRefetching } =
		useTransactions(filters)
	const { data: overview } = useTransactionsOverview(overviewFilters)

	// Saídas por dia, com os mesmos filtros (menos tipo e página)
	const {
		data: daily,
		isError: dailyError,
		isPlaceholderData: isDailyStale,
		refetch: refetchDaily,
		isRefetching: isRefetchingDaily,
	} = useDailySpending({
		...(accountId !== ALL && { accountId }),
		...(month !== ALL && { month }),
		...(q && { q }),
		...(tagId !== ALL && { tagId }),
	})

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
		...(overview?.months ?? []).map((value) => ({ value, label: formatMonth(value) })),
	]
	// Só as tags que têm transação com a conta, o período e a busca atuais; a escolhida
	// fica mesmo sem transação, para dar para desmarcar
	const tagCounts = overview?.tagCounts ?? {}
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
				actions={
					<>
						<TagManagerSheet />
						{/* Baixa todas as transações dos filtros atuais, não só a página */}
						<Button
							variant="outline"
							nativeButton={false}
							render={<a href={exportHref} download aria-label="Exportar transações em CSV" />}
						>
							<DownloadIcon data-icon="inline-start" />
							Exportar CSV
						</Button>
					</>
				}
				aside={
					<HeroMetric
						label="Saldo"
						value={data ? balance : undefined}
						className={!data ? '' : balance >= 0 ? 'text-positive' : 'text-negative'}
						items={
							data && [
								{ label: 'Entradas', value: data.summary.income, className: 'text-positive' },
								{
									label: 'Saídas',
									value: Math.abs(data.summary.expense),
									className: 'text-negative',
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
				{/*
				 * Filtros fixos no topo enquanto rola: valem para tudo que está abaixo. No celular
				 * não fixam (ocupariam meia tela) e viram uma grade de duas colunas
				 */}
				<div className="glass-bar z-10 flex flex-col gap-2 rounded-xl px-4 py-3 md:sticky md:top-14">
					<div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
						<Select
							items={accountItems}
							value={accountId}
							// Os meses dependem da conta: trocar de conta volta para todo o período
							onValueChange={(value) => setFilter({ accountId: value ?? ALL, month: ALL })}
						>
							<SelectTrigger className="col-span-2 w-full sm:w-auto sm:min-w-48" aria-label="Conta">
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
							<SelectTrigger className="w-full sm:w-auto sm:min-w-44" aria-label="Mês">
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
							<SelectTrigger className="w-full sm:w-auto sm:min-w-40" aria-label="Tag">
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
							className="col-span-2 w-full sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none"
							value={[type]}
							onValueChange={(values) => setFilter({ type: values[0] ?? ALL })}
						>
							<ToggleGroupItem value={ALL}>Todas</ToggleGroupItem>
							<ToggleGroupItem value="income">Entradas</ToggleGroupItem>
							<ToggleGroupItem value="expense">Saídas</ToggleGroupItem>
						</ToggleGroup>

						<InputGroup className="col-span-2 sm:ml-auto sm:max-w-64">
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
						<span className="text-muted-foreground" aria-live="polite">
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
					{overview && (
						<PageSection
							title="Evolução"
							description="O gráfico mostra todos os meses; os gastos por tag ignoram o filtro de tag."
						>
							<div className="grid gap-6 md:grid-cols-[3fr_2fr]">
								{/* Resposta em cache de antes do byMonth existir não tem o campo */}
								{overview.byMonth?.length ? (
									<IncomeExpenseChart
										granularity="month"
										periods={overview.byMonth}
										selectedStart={month === ALL ? null : `${month}-01`}
										description="Todos os meses, com conta, tag e busca. Clique numa coluna para filtrar o mês."
										// Clicar no mês já selecionado volta para todo o período
										onSelect={(start) => {
											const clicked = start.slice(0, 7)
											setFilter({ month: clicked === month ? ALL : clicked })
										}}
									/>
								) : null}
								{(overview.byTag.length > 0 || overview.untagged.count > 0) && (
									<SpendingByTag
										tags={tags}
										byTag={overview.byTag}
										untagged={overview.untagged}
										activeTagId={tagId === ALL ? null : tagId}
										onSelect={(id) => setFilter({ tagId: id ?? ALL })}
									/>
								)}
							</div>
						</PageSection>
					)}

					<PageSection
						title="Hábitos de gasto"
						description="Consideram só as saídas que contam nos totais, com conta, mês, tag e busca."
					>
						{dailyError && (
							<QueryError
								message="Não foi possível carregar os gastos por dia."
								onRetry={() => refetchDaily()}
								retrying={isRefetchingDaily}
							/>
						)}
						{daily ? (
							<div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
								<SpendingHeatmap
									days={daily}
									month={month === ALL ? null : month}
									isStale={isDailyStale}
								/>
								<WeekdaySpending
									days={daily}
									month={month === ALL ? null : month}
									isStale={isDailyStale}
								/>
							</div>
						) : (
							!dailyError && <Skeleton className="h-64 w-full" />
						)}
					</PageSection>

					<PageSection
						title="Lançamentos"
						description={data && `Página ${data.page} de ${totalPages}`}
					>
						{isError && (
							<QueryError
								message="Não foi possível carregar as transações."
								onRetry={() => refetch()}
								retrying={isRefetching}
							/>
						)}

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
										Mude os filtros ou importe um extrato em Contas.
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
														{/* Até duas linhas: a descrição do extrato é a única pista do que foi a compra */}
														<span className="line-clamp-2 break-words" title={tx.description}>
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
																description={tx.description}
															/>
														</div>
													</TableCell>
													<TableCell className="hidden sm:table-cell">
														<TransactionTagsCell
															transactionId={tx.id}
															tagIds={tx.tagIds}
															tags={tags}
															description={tx.description}
														/>
													</TableCell>
													<TableCell className="hidden text-muted-foreground md:table-cell">
														{tx.account.bankName}
													</TableCell>
													<TableCell
														className={cn(
															'pr-4 text-right align-top font-medium tabular-nums',
															isExcluded(tx.tagIds)
																? 'text-muted-foreground'
																: tx.amount >= 0
																	? 'text-positive'
																	: 'text-negative',
														)}
													>
														{tx.amount >= 0 ? '+' : '-'}
														{formatCurrency(Math.abs(tx.amount))}
														{/* Escrito, não só em tooltip: o cinza sozinho não explica o motivo */}
														{isExcluded(tx.tagIds) && (
															<span className="block text-xs font-normal">fora dos totais</span>
														)}
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
