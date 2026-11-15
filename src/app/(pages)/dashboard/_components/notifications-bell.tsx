'use client'

import { formatDistanceToNowStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
	BellIcon,
	CalendarRangeIcon,
	CheckCheckIcon,
	HandCoinsIcon,
	ListIcon,
	type LucideIcon,
	PiggyBankIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type InboxNotification, useInbox, useMarkNotificationsRead } from '@/hooks/notifications'
import { cn } from '@/lib/utils'

const KIND_ICON: Record<InboxNotification['kind'], LucideIcon> = {
	bills: HandCoinsIcon,
	weekly: CalendarRangeIcon,
	monthly: CalendarRangeIcon,
	budget: PiggyBankIcon,
}

const timeAgo = (date: string) =>
	formatDistanceToNowStrict(new Date(date), { addSuffix: true, locale: ptBR })

/** Sino no topo do dashboard: avisos de contas, resumos e orçamento */
export function NotificationsBell({ className }: { className?: string }) {
	const router = useRouter()
	const { data } = useInbox()
	const markRead = useMarkNotificationsRead()
	const items = data?.items ?? []
	const unread = data?.unread ?? 0

	// Aviso que chega com o app aberto também aparece como toast; os antigos não
	const seen = useRef<Set<string> | null>(null)
	// biome-ignore lint/correctness/useExhaustiveDependencies: open só usa o router e a mutação; roda só quando chegam dados
	useEffect(() => {
		if (!data) return
		if (seen.current) {
			for (const item of data.items) {
				if (item.readAt || seen.current.has(item.id)) continue
				toast(item.title, {
					description: item.body ?? undefined,
					action: item.href ? { label: 'Abrir', onClick: () => open(item) } : undefined,
				})
			}
		}
		seen.current = new Set(data.items.map((item) => item.id))
	}, [data])

	function open(item: InboxNotification) {
		if (!item.readAt) markRead.mutate([item.id])
		if (item.href) router.push(item.href)
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="icon-sm"
						className={cn('relative', className)}
						aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : 'Notificações'}
					/>
				}
			>
				<BellIcon />
				{unread > 0 && (
					<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
						{unread > 9 ? '9+' : unread}
					</span>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
				<div className="flex items-center justify-between gap-2 px-1.5 py-1">
					<span className="text-sm font-medium">Notificações</span>
					{unread > 0 && (
						<Button
							variant="ghost"
							size="xs"
							onClick={() => markRead.mutate(undefined)}
							disabled={markRead.isPending}
						>
							<CheckCheckIcon data-icon="inline-start" />
							Marcar todas como lidas
						</Button>
					)}
				</div>
				<DropdownMenuSeparator />

				{items.length === 0 ? (
					<p className="px-1.5 py-6 text-center text-sm text-muted-foreground">
						Nenhum aviso por enquanto.
					</p>
				) : (
					items.map((item) => {
						const Icon = KIND_ICON[item.kind] ?? BellIcon
						return (
							<DropdownMenuItem
								key={item.id}
								onClick={() => open(item)}
								className="items-start gap-2.5 py-2"
							>
								<Icon className="mt-0.5 text-muted-foreground" />
								<div className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span
										className={cn(
											'text-sm leading-snug',
											item.readAt ? 'text-muted-foreground' : 'font-medium',
										)}
									>
										{item.title}
									</span>
									{item.body && <span className="text-xs text-muted-foreground">{item.body}</span>}
									<span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
								</div>
								{!item.readAt && (
									<span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
								)}
							</DropdownMenuItem>
						)
					})
				)}

				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => router.push('/dashboard/notifications')}>
					<ListIcon />
					Ver todas e preferências
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
