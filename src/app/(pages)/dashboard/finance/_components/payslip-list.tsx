'use client'

import { ReceiptTextIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Payslip } from '@/hooks/finance/payslips'
import { useDeletePayslip } from '@/hooks/finance/payslips'
import { formatCompetence, formatCurrency } from '@/lib/format'

interface PayslipListProps {
	payslips: Payslip[]
}

export function PayslipList({ payslips }: PayslipListProps) {
	const { mutate: deletePayslip, isPending: isRemoving } = useDeletePayslip()

	function handleRemove(payslip: Payslip) {
		const month = formatCompetence(payslip.competence)
		if (!confirm(`Remover o holerite ${month} de ${payslip.employerName}?`)) return

		deletePayslip(payslip.id, {
			onSuccess: () => toast.success(`Holerite ${month} removido`),
			onError: () => toast.error('Erro ao remover holerite'),
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
					{payslips.map((payslip) => (
						<li key={payslip.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
							<div className="flex min-w-0 flex-1 flex-col">
								<span className="font-medium">
									{formatCompetence(payslip.competence)} · {payslip.employerName}
								</span>
								<span className="text-xs text-muted-foreground">
									Bruto {formatCurrency(payslip.grossAmount)} · Descontos{' '}
									{formatCurrency(payslip.deductionsAmount)}
									{payslip.fgtsAmount !== null && ` · FGTS ${formatCurrency(payslip.fgtsAmount)}`}
								</span>
							</div>
							<span className="shrink-0 font-medium text-green-600">
								{formatCurrency(payslip.netAmount)}
							</span>
							<Button
								variant="ghost"
								size="icon"
								className="text-muted-foreground hover:text-destructive"
								disabled={isRemoving}
								onClick={() => handleRemove(payslip)}
							>
								<Trash2Icon className="size-4" />
							</Button>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	)
}
