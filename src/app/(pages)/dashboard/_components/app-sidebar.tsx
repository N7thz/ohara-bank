'use client'

import {
	ArrowLeftRightIcon,
	BellIcon,
	BuildingIcon,
	HandCoinsIcon,
	LayoutDashboardIcon,
	LogOutIcon,
	PiggyBankIcon,
	RepeatIcon,
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
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from '@/components/ui/sidebar'
import { usePrefetchFinancePage } from '@/hooks/finance/prefetch'
import { authClient } from '@/lib/auth/client'

// Em dois grupos: o dinheiro separado das configurações da conta
const navGroups = [
	{
		label: 'Dinheiro',
		items: [
			{ label: 'Resumo', href: '/dashboard', icon: LayoutDashboardIcon },
			{ label: 'Contas', href: '/dashboard/finance', icon: BuildingIcon },
			{ label: 'Transações', href: '/dashboard/finance/transactions', icon: ArrowLeftRightIcon },
			{ label: 'Dívidas', href: '/dashboard/finance/debts', icon: HandCoinsIcon },
			{ label: 'Recorrentes', href: '/dashboard/finance/recurring', icon: RepeatIcon },
			{ label: 'Metas', href: '/dashboard/finance/goals', icon: PiggyBankIcon },
		],
	},
	{
		label: 'Conta',
		items: [
			{ label: 'Notificações', href: '/dashboard/notifications', icon: BellIcon },
			{ label: 'Segurança', href: '/dashboard/security', icon: ShieldCheckIcon },
		],
	},
]
const allHrefs = navGroups.flatMap((group) => group.items.map((item) => item.href))

/** Item ativo: o href mais longo que é prefixo da rota, para as subpáginas também marcarem */
function activeHref(pathname: string) {
	return allHrefs
		.filter((href) => pathname === href || pathname.startsWith(`${href}/`))
		.sort((a, b) => b.length - a.length)[0]
}

export function AppSidebar() {
	const pathname = usePathname()
	const router = useRouter()
	const { data: session } = authClient.useSession()
	// Busca os dados da página antes do clique; a navegação abre com tudo em cache
	const prefetch = usePrefetchFinancePage()
	const active = activeHref(pathname)

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
				{navGroups.map((group) => (
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton
											isActive={item.href === active}
											tooltip={item.label}
											render={
												<Link
													href={item.href}
													aria-current={item.href === active ? 'page' : undefined}
												/>
											}
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
				))}
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						{/* Leva para a segurança da conta: antes era um botão que não fazia nada */}
						<SidebarMenuButton
							tooltip={session?.user.email ?? 'Conta'}
							size="lg"
							render={<Link href="/dashboard/security" />}
						>
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
