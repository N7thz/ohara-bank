'use client'

import { HeroMetric } from '@/components/finance/hero-metric'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { Skeleton } from '@/components/ui/skeleton'
import { useBankAccounts } from '@/hooks/finance/accounts'
import { usePayslips } from '@/hooks/finance/payslips'
import { BankAccountCard } from './bank-account-card'
import { ImportStatementDropzone } from './import-statement-dropzone'
import { PayslipList } from './payslip-list'

export function FinanceView() {
	const { data: accounts = [], isLoading, isError } = useBankAccounts()
	const { data: payslips = [] } = usePayslips()

	const checkingAccounts = accounts.filter((account) => account.balance !== null)
	const totalBalance = checkingAccounts.reduce((sum, account) => sum + (account.balance ?? 0), 0)

	return (
		<div className="stagger page-stack">
			<PageHeader
				title="Finanças"
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
				{isError && <p className="text-sm text-destructive">Erro ao carregar contas importadas.</p>}
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
					description={`${accounts.length} ${accounts.length === 1 ? 'conta importada' : 'contas importadas'}, com as últimas transações.`}
					className="reveal"
				>
					<div className="stagger grid items-start gap-6 md:grid-cols-2">
						{accounts.map((account) => (
							<BankAccountCard key={account.id} account={account} />
						))}
					</div>
				</PageSection>
			)}

			{payslips.length > 0 && (
				<PageSection title="Holerites" className="reveal">
					<div className="lg:max-w-3xl">
						<PayslipList payslips={payslips} />
					</div>
				</PageSection>
			)}
		</div>
	)
}
