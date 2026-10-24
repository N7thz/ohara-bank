import { Badge } from '@/components/ui/badge'
import type { LoginTotpStatus } from '@/hooks/security/totp'

const STATUS_BADGE: Record<
	LoginTotpStatus['status'],
	{ label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
	connected: { label: 'Conectado', variant: 'default' },
	locked: { label: 'Bloqueado', variant: 'destructive' },
	pending: { label: 'Não confirmado', variant: 'secondary' },
	'not-configured': { label: 'Não configurado', variant: 'outline' },
}

export function TotpStatusBadge({ status }: { status: LoginTotpStatus['status'] }) {
	const { label, variant } = STATUS_BADGE[status]
	return <Badge variant={variant}>{label}</Badge>
}
