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

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { BankAccount } from '@/hooks/finance/accounts'
import { useDeleteBankAccount } from '@/hooks/finance/accounts'
import { formatCurrency, formatDate } from '@/lib/format'
import { StatementTransactionList } from './statement-transaction-list'

interface BankAccountCardProps {
	account: BankAccount
}

export function BankAccountCard({ account }: BankAccountCardProps) {
	const [expanded, setExpanded] = useState(false)

	const { mutate: deleteAccount, isPending: isRemoving } = useDeleteBankAccount()

	const isCreditCard = account.type === 'CREDIT_CARD'
	const Icon = isCreditCard ? CreditCardIcon : LandmarkIcon

	function handleRemove() {
		if (!confirm(`Remover ${account.bankName} e todas as transações importadas?`)) return

		deleteAccount(account.id, {
			onSuccess: () => toast.success(`${account.bankName} removido`),
			onError: () => toast.error('Erro ao remover conta'),
		})
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center gap-3">
				<div className="flex size-8 items-center justify-center rounded bg-muted">
					<Icon className="size-4" />
				</div>
				<div className="flex flex-1 flex-col">
					<CardTitle className="text-base">{account.bankName}</CardTitle>
					<span className="text-xs text-muted-foreground">
						{isCreditCard ? 'Cartão de crédito' : 'Conta'} · {account.number}
					</span>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="text-muted-foreground hover:text-destructive"
					disabled={isRemoving}
					onClick={handleRemove}
				>
					<Trash2Icon className="size-4" />
				</Button>
			</CardHeader>

			<CardContent className="flex flex-col gap-0 p-0 pb-2">
				{account.balance !== null && (
					<div className="flex items-baseline justify-between px-4 pb-2">
						<span className="text-sm text-muted-foreground">
							Saldo
							{account.balanceDate && ` em ${formatDate(account.balanceDate)}`}
						</span>
						<span className="font-semibold">{formatCurrency(account.balance)}</span>
					</div>
				)}

				<button
					type="button"
					className="flex w-full items-center justify-between px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
					onClick={() => setExpanded((prev) => !prev)}
				>
					<span>{account.transactionCount} transações</span>
					{expanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
				</button>

				{expanded && <StatementTransactionList accountId={account.id} />}
			</CardContent>
		</Card>
	)
}
