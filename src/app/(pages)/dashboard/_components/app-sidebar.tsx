'use client'

import {
	ArrowLeftRightIcon,
	BuildingIcon,
	HandCoinsIcon,
	LayoutDashboardIcon,
	LogOutIcon,
	ShieldCheckIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from '@/components/ui/sidebar'
import { usePrefetchFinancePage } from '@/hooks/finance/prefetch'
import { authClient } from '@/lib/auth/client'

const navItems = [
	{ label: 'Resumo', href: '/dashboard', icon: LayoutDashboardIcon },
	{ label: 'Finanças', href: '/dashboard/finance', icon: BuildingIcon },
	{ label: 'Transações', href: '/dashboard/finance/transactions', icon: ArrowLeftRightIcon },
	{ label: 'Dívidas', href: '/dashboard/finance/debts', icon: HandCoinsIcon },
	{ label: 'Segurança', href: '/dashboard/security', icon: ShieldCheckIcon },
]

export function AppSidebar() {
	const pathname = usePathname()
	const router = useRouter()
	const { data: session } = authClient.useSession()
	// Busca os dados da página antes do clique; a navegação abre com tudo em cache
	const prefetch = usePrefetchFinancePage()

	async function handleSignOut() {
		await authClient.signOut()
		toast.success('Sessão encerrada')
		router.push('/')
	}

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
								OB
							</div>
							<span className="font-semibold">Ohara Bank</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										isActive={pathname === item.href}
										tooltip={item.label}
										render={<Link href={item.href} />}
										onMouseEnter={() => prefetch(item.href)}
										onFocus={() => prefetch(item.href)}
									>
										<item.icon />
										<span>{item.label}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton tooltip={session?.user.email ?? ''} size="lg">
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold uppercase">
								{session?.user.name?.charAt(0) ?? '?'}
							</div>
							<div className="flex min-w-0 flex-col">
								<span className="truncate text-sm font-medium">{session?.user.name}</span>
								<span className="truncate text-xs text-muted-foreground">
									{session?.user.email}
								</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton tooltip="Sair" onClick={handleSignOut}>
							<LogOutIcon />
							<span>Sair</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	)
}
