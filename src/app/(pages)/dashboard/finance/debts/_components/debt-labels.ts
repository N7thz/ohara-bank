import type { DebtKind, DebtMonthStatus } from '@/hooks/finance/debts'

export const DEBT_KIND_LABEL: Record<DebtKind, string> = {
	FIXED: 'Fixa',
	RECURRING: 'Recorrente',
	INSTALLMENT: 'Parcelada',
}

export const DEBT_KIND_SECTION: Record<DebtKind, { title: string; description: string }> = {
	FIXED: { title: 'Fixas', description: 'Mesmo valor todo mês.' },
	RECURRING: { title: 'Recorrentes', description: 'Todo mês, mas o valor muda.' },
	INSTALLMENT: { title: 'Parceladas', description: 'Número fechado de parcelas.' },
}

export const DEBT_STATUS: Record<
	DebtMonthStatus,
	{ label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
	paid: { label: 'Pago no mês', variant: 'default' },
	partial: { label: 'Pago em parte', variant: 'secondary' },
	pending: { label: 'A pagar', variant: 'outline' },
	late: { label: 'Atrasada', variant: 'destructive' },
	'not-started': { label: 'Ainda não começou', variant: 'outline' },
	finished: { label: 'Quitada', variant: 'secondary' },
}
