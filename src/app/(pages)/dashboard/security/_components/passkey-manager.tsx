'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { FingerprintIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { authClient } from '@/lib/auth/client'

const nameSchema = z.object({
	name: z.string().trim().max(50, 'Máximo de 50 caracteres'),
})

type NameData = z.infer<typeof nameSchema>

export function PasskeyManager() {
	const { data: passkeys, isPending } = authClient.useListPasskeys()
	const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null)
	const isLast = (passkeys?.length ?? 0) <= 1

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<NameData>({
		resolver: zodResolver(nameSchema),
		defaultValues: { name: '' },
	})

	async function handleAdd({ name }: NameData) {
		const { error } = await authClient.passkey.addPasskey({ name: name || undefined })

		if (error) {
			if ('code' in error && error.code === 'SESSION_NOT_FRESH')
				toast.error('Entre de novo para alterar a segurança da conta: saia e faça login outra vez.')
			else if (!('code' in error && error.code === 'AUTH_CANCELLED'))
				toast.error('Não foi possível cadastrar a passkey')
			return
		}

		reset()
		toast.success('Passkey cadastrada')
	}

	async function handleDelete({ id }: { id: string }) {
		const { error } = await authClient.passkey.deletePasskey({ id })
		if (error) throw error
		toast.success('Passkey removida')
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Passkeys</CardTitle>
				<CardDescription>
					Entre com Windows Hello, biometria do celular ou chave de segurança, sem senha.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{isPending && <Skeleton className="h-10 w-full" />}

				{!isPending && passkeys?.length === 0 && (
					<p className="text-sm text-muted-foreground">Nenhuma passkey cadastrada ainda.</p>
				)}

				{passkeys && passkeys.length > 0 && (
					<ul className="divide-y rounded-lg border">
						{passkeys.map((passkey) => {
							const label = passkey.name || 'Passkey'
							return (
								<li key={passkey.id} className="flex items-center gap-3 px-3 py-2 text-sm">
									<FingerprintIcon className="size-4 text-muted-foreground" />
									<div className="flex flex-1 flex-col">
										<span className="font-medium">{label}</span>
										{passkey.createdAt && (
											<span className="text-xs text-muted-foreground">
												Criada em {format(passkey.createdAt, 'dd/MM/yyyy')}
											</span>
										)}
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="text-muted-foreground hover:text-destructive"
										aria-label={`Remover a passkey ${label}`}
										onClick={() => setRemoving({ id: passkey.id, label })}
									>
										<Trash2Icon className="size-4" />
									</Button>
								</li>
							)
						})}
					</ul>
				)}

				<form onSubmit={handleSubmit(handleAdd)} className="flex flex-col gap-1.5">
					<div className="flex gap-2">
						<Input
							placeholder="Nome (ex.: Notebook, Celular)"
							aria-invalid={!!errors.name}
							{...register('name')}
						/>
						<Button type="submit" disabled={isSubmitting}>
							<PlusIcon />
							{isSubmitting ? 'Aguardando...' : 'Adicionar'}
						</Button>
					</div>
					{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
				</form>
			</CardContent>

			<ConfirmDialog
				open={!!removing}
				onOpenChange={(open) => !open && setRemoving(null)}
				title={isLast ? 'Remover a única passkey?' : `Remover a passkey "${removing?.label}"?`}
				description={
					isLast ? (
						<p>
							Esta é a sua única passkey. Sem ela, você só entra com o código do autenticador, e se
							ele também não estiver à mão, fica sem acesso à conta. Não dá para desfazer; para
							voltar a usar passkey, é preciso cadastrar de novo.
						</p>
					) : (
						<p>
							O dispositivo "{removing?.label}" deixa de entrar com esta passkey. Não dá para
							desfazer; para voltar a usá-lo, cadastre a passkey de novo nele.
						</p>
					)
				}
				confirmLabel={isLast ? 'Remover mesmo assim' : 'Remover passkey'}
				destructive
				errorMessage="Erro ao remover passkey"
				onConfirm={() => removing && handleDelete(removing)}
			/>
		</Card>
	)
}
