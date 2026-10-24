'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CreditCardIcon, LandmarkIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BankAccount } from '@/hooks/finance/accounts'
import { useBankAccounts } from '@/hooks/finance/accounts'

const accountInfoSchema = z.object({
	bankName: z.string().trim().min(1, 'Informe o banco'),
	type: z.enum(['CHECKING', 'CREDIT_CARD']),
})

type AccountInfoData = z.infer<typeof accountInfoSchema>

const DEFAULT_VALUES: AccountInfoData = { bankName: '', type: 'CHECKING' }

interface AccountInfoDialogProps {
	/** Arquivo aguardando informações; null fecha o diálogo */
	fileName: string | null
	onConfirm: (info: { bankName: string; type: BankAccount['type'] }) => void
	onCancel: () => void
}

export function AccountInfoDialog({ fileName, onConfirm, onCancel }: AccountInfoDialogProps) {
	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors },
	} = useForm<AccountInfoData>({
		resolver: zodResolver(accountInfoSchema),
		defaultValues: DEFAULT_VALUES,
	})

	const type = watch('type')

	const { data: accounts = [] } = useBankAccounts()
	const bankNames = [...new Set(accounts.map((account) => account.bankName))]

	useEffect(() => {
		if (fileName) reset(DEFAULT_VALUES)
	}, [fileName, reset])

	return (
		<Dialog open={!!fileName} onOpenChange={(open) => !open && onCancel()}>
			<DialogContent>
				<form onSubmit={handleSubmit(onConfirm)} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>De qual conta é este extrato?</DialogTitle>
						<DialogDescription>
							<span className="break-all font-medium">{fileName}</span> não informa o banco.
							Transações já importadas não são duplicadas.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="import-bank-name">Banco</Label>
						<Input
							id="import-bank-name"
							list="import-bank-names"
							placeholder="Ex.: Itaú, Inter, C6"
							autoFocus
							aria-invalid={!!errors.bankName}
							{...register('bankName')}
						/>
						<datalist id="import-bank-names">
							{bankNames.map((name) => (
								<option key={name} value={name} />
							))}
						</datalist>
						{errors.bankName && (
							<p className="text-xs text-destructive">{errors.bankName.message}</p>
						)}
					</div>

					<div className="flex flex-col gap-1.5">
						<Label>Tipo</Label>
						<div className="grid grid-cols-2 gap-2">
							<Button
								type="button"
								variant={type === 'CHECKING' ? 'default' : 'outline'}
								onClick={() => setValue('type', 'CHECKING')}
							>
								<LandmarkIcon />
								Conta
							</Button>
							<Button
								type="button"
								variant={type === 'CREDIT_CARD' ? 'default' : 'outline'}
								onClick={() => setValue('type', 'CREDIT_CARD')}
							>
								<CreditCardIcon />
								Cartão
							</Button>
						</div>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={onCancel}>
							Pular arquivo
						</Button>
						<Button type="submit">Importar</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
