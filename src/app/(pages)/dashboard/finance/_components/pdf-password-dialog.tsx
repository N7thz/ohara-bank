'use client'

import { zodResolver } from '@hookform/resolvers/zod'
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

const passwordSchema = z.object({
	password: z.string().trim().min(1, 'Informe a senha do PDF'),
})

type PasswordData = z.infer<typeof passwordSchema>

interface PdfPasswordDialogProps {
	/** Arquivo aguardando a senha; null fecha o diálogo */
	fileName: string | null
	/** A senha enviada antes estava errada */
	wrongPassword: boolean
	onConfirm: (password: string) => void
	onCancel: () => void
}

/** PDF protegido (fatura do cartão Itaú): pede a senha e reenvia o arquivo */
export function PdfPasswordDialog({
	fileName,
	wrongPassword,
	onConfirm,
	onCancel,
}: PdfPasswordDialogProps) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<PasswordData>({
		resolver: zodResolver(passwordSchema),
		defaultValues: { password: '' },
	})

	useEffect(() => {
		if (fileName) reset({ password: '' })
	}, [fileName, reset])

	return (
		<Dialog open={!!fileName} onOpenChange={(open) => !open && onCancel()}>
			<DialogContent>
				<form
					onSubmit={handleSubmit(({ password }) => onConfirm(password))}
					className="flex flex-col gap-4"
				>
					<DialogHeader>
						<DialogTitle>Este PDF tem senha</DialogTitle>
						<DialogDescription>
							<span className="break-all font-medium">{fileName}</span> está protegido. Na fatura do
							cartão Itaú, a senha são os 5 primeiros dígitos do seu CPF. A senha só é usada para
							ler o arquivo e não fica salva.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="import-pdf-password">Senha do PDF</Label>
						<Input
							id="import-pdf-password"
							type="password"
							autoComplete="off"
							autoFocus
							aria-invalid={!!errors.password || wrongPassword}
							aria-describedby="import-pdf-password-error"
							{...register('password')}
						/>
						<p id="import-pdf-password-error" className="text-xs text-negative" role="alert">
							{errors.password?.message ??
								(wrongPassword ? 'Senha incorreta. Confira e tente de novo.' : '')}
						</p>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={onCancel}>
							Pular arquivo
						</Button>
						<Button type="submit">Abrir e importar</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
