'use client'

import { CircleAlertIcon, RotateCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface QueryErrorProps {
	/** O que não carregou, dito pelo usuário: "Não foi possível carregar o resumo." */
	message: string
	onRetry: () => void
	/** Enquanto tenta de novo, o botão fica girando e desabilitado */
	retrying?: boolean
	className?: string
}

/** Erro de carregamento com o motivo e o botão de tentar de novo; anunciado pelo leitor de tela */
export function QueryError({ message, onRetry, retrying, className }: QueryErrorProps) {
	return (
		<div
			role="alert"
			className={cn(
				'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-negative/30 bg-negative/5 px-3 py-2 text-sm text-negative',
				className,
			)}
		>
			<CircleAlertIcon className="size-4 shrink-0" aria-hidden />
			<span className="min-w-0 flex-1">{message} Confira a conexão e tente de novo.</span>
			<Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
				<RotateCwIcon className={cn(retrying && 'animate-spin')} aria-hidden />
				Tentar de novo
			</Button>
		</div>
	)
}
