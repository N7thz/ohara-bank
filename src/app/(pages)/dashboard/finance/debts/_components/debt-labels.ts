import type { DebtKind, DebtMonthStatus, DebtOverrideStatus } from '@/hooks/finance/debts'

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
	skipped: { label: 'Não cobrada no mês', variant: 'secondary' },
	'not-started': { label: 'Ainda não começou', variant: 'outline' },
	finished: { label: 'Quitada', variant: 'secondary' },
}

/** Opções do menu de situação; "auto" volta para a calculada pelas transações */
export const DEBT_OVERRIDE_OPTIONS: { value: DebtOverrideStatus | 'auto'; label: string }[] = [
	{ value: 'auto', label: 'Automático' },
	{ value: 'PAID', label: 'Pago' },
	{ value: 'PENDING', label: 'A pagar' },
	{ value: 'SKIPPED', label: 'Não cobrada no mês' },
]
