'use client'

import { HeroMetric } from '@/components/finance/hero-metric'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { QueryError } from '@/components/query-error'
import { Skeleton } from '@/components/ui/skeleton'
import { useBankAccounts } from '@/hooks/finance/accounts'
import { usePayslips } from '@/hooks/finance/payslips'
import { BalanceHistoryChart } from './balance-history-chart'
import { BankCard } from './bank-account-card'
import { ImportStatementDropzone } from './import-statement-dropzone'
import { PayslipChart } from './payslip-chart'
import { PayslipList } from './payslip-list'

export function FinanceView() {
	const { data: accounts = [], isLoading, isError, refetch, isRefetching } = useBankAccounts()
	const { data: payslips = [] } = usePayslips()

	// Um card por banco: no Itaú, a conta corrente e o cartão ficam juntos
	const banks = Map.groupBy(accounts, (account) => account.bankName)

	const checkingAccounts = accounts.filter((account) => account.balance !== null)
	const totalBalance = checkingAccounts.reduce((sum, account) => sum + (account.balance ?? 0), 0)

	return (
		<div className="stagger page-stack">
			<PageHeader
				title="Contas"
				description="Contas, extratos importados e holerites. Arraste um extrato ou holerite para importar."
				aside={
					(isLoading || checkingAccounts.length > 0) && (
						<HeroMetric
							label="Saldo total em conta"
							value={isLoading ? undefined : totalBalance}
							items={checkingAccounts.map((account) => ({
								label: `${account.bankName} · ${account.number}`,
								value: account.balance ?? 0,
							}))}
						/>
					)
				}
			>
				{isError && (
					<QueryError
						message="Não foi possível carregar as contas importadas."
						onRetry={() => refetch()}
						retrying={isRefetching}
					/>
				)}
			</PageHeader>

			<PageSection
				title="Importar"
				description="Extrato em OFX, CSV ou PDF do Itaú, ou holerite em PDF."
			>
				<ImportStatementDropzone />
				{!isLoading && !isError && accounts.length === 0 && payslips.length === 0 && (
					<p className="text-sm text-muted-foreground">
						Nenhum extrato importado. Baixe o extrato em OFX no app ou internet banking do seu banco
						e arraste o arquivo para a área acima.
					</p>
				)}
			</PageSection>

			{isLoading && <Skeleton className="h-64" />}

			{accounts.length > 0 && (
				<PageSection
					title="Contas"
					description={`${banks.size} ${banks.size === 1 ? 'banco' : 'bancos'}, com contas, cartões e as últimas transações.`}
				>
					<div className="stagger grid items-start gap-6 md:grid-cols-2">
						{[...banks].map(([bankName, bankAccounts]) => (
							<BankCard key={bankName} bankName={bankName} accounts={bankAccounts} />
						))}
					</div>
				</PageSection>
			)}

			{checkingAccounts.length > 0 && (
				<PageSection
					title="Saldo ao longo do tempo"
					description="Quanto você tinha em conta no fim de cada dia."
				>
					<BalanceHistoryChart accounts={checkingAccounts} />
				</PageSection>
			)}

			{payslips.length > 0 && (
				<PageSection title="Holerites">
					<PayslipChart payslips={payslips} />
					<div className="lg:max-w-3xl">
						<PayslipList payslips={payslips} />
					</div>
				</PageSection>
			)}
		</div>
	)
}
