'use client'

import { ReceiptTextIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Payslip } from '@/hooks/finance/payslips'
import { useDeletePayslip } from '@/hooks/finance/payslips'
import { formatCompetence, formatCurrency } from '@/lib/format'

const UNDO_MS = 6000

interface PayslipListProps {
	payslips: Payslip[]
}

export function PayslipList({ payslips }: PayslipListProps) {
	const { mutateAsync: deletePayslip } = useDeletePayslip()
	const [removing, setRemoving] = useState<Payslip | null>(null)
	// Escondidos da lista enquanto esperam o fim do prazo do "Desfazer"
	const [hiddenIds, setHiddenIds] = useState<string[]>([])

	const visible = payslips.filter((payslip) => !hiddenIds.includes(payslip.id))

	const unhide = (id: string) => setHiddenIds((ids) => ids.filter((item) => item !== id))

	// A API não recria holerite (ele vem do PDF importado), então a exclusão real só
	// acontece depois do prazo; "Desfazer" cancela e o holerite volta à lista
	function handleRemove(payslip: Payslip) {
		const month = formatCompetence(payslip.competence)
		setHiddenIds((ids) => [...ids, payslip.id])

		const timer = setTimeout(() => {
			deletePayslip(payslip.id).catch(() => {
				unhide(payslip.id)
				toast.error(`Erro ao remover o holerite ${month}`)
			})
		}, UNDO_MS)

		toast.success(`Holerite ${month} removido`, {
			duration: UNDO_MS,
			action: {
				label: 'Desfazer',
				onClick: () => {
					clearTimeout(timer)
					unhide(payslip.id)
				},
			},
		})
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center gap-3">
				<div className="flex size-8 items-center justify-center rounded bg-muted">
					<ReceiptTextIcon className="size-4" />
				</div>
				<CardTitle className="text-base">Holerites</CardTitle>
			</CardHeader>

			<CardContent className="p-0 pb-2">
				<ul className="divide-y border-t">
					{visible.map((payslip) => (
						<li key={payslip.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
							<div className="flex min-w-0 flex-1 flex-col">
								<span className="font-medium">
									{formatCompetence(payslip.competence)}
									{payslip.kind === 'THIRTEENTH' && ' · 13º'}
									{payslip.kind === 'VACATION' && ' · Férias'} · {payslip.employerName}
								</span>
								<span className="text-xs text-muted-foreground">
									Bruto {formatCurrency(payslip.grossAmount)} · Descontos{' '}
									{formatCurrency(payslip.deductionsAmount)}
									{payslip.fgtsAmount !== null && ` · FGTS ${formatCurrency(payslip.fgtsAmount)}`}
								</span>
							</div>
							<span className="shrink-0 font-medium text-positive">
								{formatCurrency(payslip.netAmount)}
							</span>
							<Button
								variant="ghost"
								size="icon"
								className="text-muted-foreground hover:text-destructive"
								aria-label={`Remover o holerite ${formatCompetence(payslip.competence)}`}
								onClick={() => setRemoving(payslip)}
							>
								<Trash2Icon className="size-4" />
							</Button>
						</li>
					))}
				</ul>
			</CardContent>

			<ConfirmDialog
				open={!!removing}
				onOpenChange={(open) => !open && setRemoving(null)}
				title={
					removing
						? `Remover o holerite ${formatCompetence(removing.competence)}?`
						: 'Remover holerite'
				}
				description={
					<p>
						O holerite de {removing?.employerName} sai da lista, com todos os seus itens. Se foi sem
						querer, toque em "Desfazer" no aviso que aparece. Passado o aviso, só importando o PDF
						de novo.
					</p>
				}
				confirmLabel="Remover holerite"
				destructive
				onConfirm={() => removing && handleRemove(removing)}
			/>
		</Card>
	)
}
