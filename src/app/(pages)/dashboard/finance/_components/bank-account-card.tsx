'use client'

import {
	ChevronDownIcon,
	ChevronUpIcon,
	CreditCardIcon,
	LandmarkIcon,
	Trash2Icon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { BankAccount } from '@/hooks/finance/accounts'
import { useDeleteBankAccount } from '@/hooks/finance/accounts'
import { formatCurrency, formatDate } from '@/lib/format'
import { StatementTransactionList } from './statement-transaction-list'

const kindLabel = (account: BankAccount) =>
	account.type === 'CREDIT_CARD' ? 'Cartão de crédito' : 'Conta'

/** Uma conta ou cartão dentro do card do banco: saldo, transações e remover */
function AccountSection({ account }: { account: BankAccount }) {
	const [expanded, setExpanded] = useState(false)
	const [confirmingRemove, setConfirmingRemove] = useState(false)
	const { mutateAsync: deleteAccount } = useDeleteBankAccount()

	const isCreditCard = account.type === 'CREDIT_CARD'
	const Icon = isCreditCard ? CreditCardIcon : LandmarkIcon
	const label = `${kindLabel(account)} · ${account.number}`

	async function handleRemove() {
		await deleteAccount(account.id)
		toast.success(`${account.bankName} · ${account.number} removido`)
	}

	const transactionLabel = `${account.transactionCount} ${account.transactionCount === 1 ? 'transação importada' : 'transações importadas'}`

	return (
		<div className="flex flex-col">
			<div className="flex items-center gap-2 px-4 pt-2">
				<Icon className="size-4 shrink-0 text-muted-foreground" />
				<span className="flex-1 truncate text-sm font-medium">{label}</span>
				<Button
					variant="ghost"
					size="icon-sm"
					className="text-muted-foreground hover:text-destructive"
					aria-label={`Remover ${account.bankName} ${label}`}
					onClick={() => setConfirmingRemove(true)}
				>
					<Trash2Icon className="size-4" />
				</Button>
			</div>

			{account.balance !== null && (
				<div className="flex items-baseline justify-between px-4 pb-1">
					<span className="text-sm text-muted-foreground">
						Saldo
						{account.balanceDate && ` em ${formatDate(account.balanceDate)}`}
					</span>
					<span className="font-semibold tabular-nums">{formatCurrency(account.balance)}</span>
				</div>
			)}

			<button
				type="button"
				className="flex w-full items-center justify-between px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
				aria-expanded={expanded}
				onClick={() => setExpanded((prev) => !prev)}
			>
				<span>{account.transactionCount} transações</span>
				{expanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
			</button>

			{expanded && <StatementTransactionList accountId={account.id} />}

			<ConfirmDialog
				open={confirmingRemove}
				onOpenChange={setConfirmingRemove}
				title={`Remover ${account.bankName} · ${account.number}?`}
				description={
					<div className="flex flex-col gap-2">
						<p>
							{isCreditCard ? 'O cartão' : 'A conta'} e {transactionLabel} serão apagados, com o
							saldo guardado. As tags, as dívidas e os holerites continuam, mas os totais deixam de
							contar essas transações.
						</p>
						<p className="font-medium text-foreground">
							Não dá para desfazer. Para ter as transações de volta, só importando o extrato de
							novo.
						</p>
					</div>
				}
				confirmLabel={isCreditCard ? 'Remover cartão e transações' : 'Remover conta e transações'}
				destructive
				errorMessage="Erro ao remover conta"
				onConfirm={handleRemove}
			/>
		</div>
	)
}

interface BankCardProps {
	bankName: string
	/** Contas e cartões do mesmo banco; cada um continua separado no banco de dados */
	accounts: BankAccount[]
}

/** Um card por banco, com a conta corrente e o cartão juntos */
export function BankCard({ bankName, accounts }: BankCardProps) {
	const transactionCount = accounts.reduce((sum, account) => sum + account.transactionCount, 0)
	// Com uma conta só, a seção abaixo já mostra o tipo e o número
	const summary =
		accounts.length > 1
			? `${accounts.length} contas e cartões · ${transactionCount} transações`
			: null

	return (
		<Card>
			<CardHeader className="flex flex-row items-center gap-3">
				<div className="flex size-8 items-center justify-center rounded bg-muted">
					<LandmarkIcon className="size-4" />
				</div>
				<div className="flex flex-1 flex-col">
					<CardTitle className="text-base">{bankName}</CardTitle>
					{summary && <span className="text-xs text-muted-foreground">{summary}</span>}
				</div>
			</CardHeader>

			<CardContent className="flex flex-col gap-0 divide-y p-0 pb-2">
				{accounts.map((account) => (
					<AccountSection key={account.id} account={account} />
				))}
			</CardContent>
		</Card>
	)
}
