'use client'

import { isAxiosError } from 'axios'
import { Loader2Icon } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	/** Diga o que acontece: o que some, o que fica e se dá para desfazer */
	description: ReactNode
	/** Verbo específico: "Remover conta", nunca "OK" */
	confirmLabel: string
	/** Pode ser async: o botão trava com spinner e o diálogo só fecha no fim. Se lançar, vira toast e o diálogo continua aberto */
	onConfirm: () => unknown
	/** Botão de confirmar na variante destrutiva */
	destructive?: boolean
	/** Mensagem do toast quando onConfirm falha (usa a do servidor se houver) */
	errorMessage?: string
}

/** Confirmação de ação com consequências, no lugar do confirm() do navegador */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	onConfirm,
	destructive = false,
	errorMessage = 'Não foi possível concluir a ação',
}: ConfirmDialogProps) {
	const [isPending, setIsPending] = useState(false)
	const cancelRef = useRef<HTMLButtonElement>(null)

	async function handleConfirm() {
		setIsPending(true)
		try {
			await onConfirm()
			onOpenChange(false)
		} catch (error) {
			toast.error((isAxiosError(error) && error.response?.data?.error) || errorMessage)
		} finally {
			setIsPending(false)
		}
	}

	return (
		<AlertDialog
			open={open}
			// Enquanto roda, ESC e clique fora não fecham
			onOpenChange={(next) => !isPending && onOpenChange(next)}
		>
			<AlertDialogContent initialFocus={cancelRef} className="data-[size=default]:sm:max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription render={<div />}>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel ref={cancelRef} disabled={isPending}>
						Cancelar
					</AlertDialogCancel>
					<Button
						variant={destructive ? 'destructive' : 'default'}
						disabled={isPending}
						onClick={handleConfirm}
					>
						{isPending && <Loader2Icon className="animate-spin" />}
						{confirmLabel}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
