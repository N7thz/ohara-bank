import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './_components/app-sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
					<SidebarTrigger />
				</header>
				{/* Largura máxima: em telas largas a tabela e os gráficos não esticam demais */}
				<main className="mx-auto flex w-full max-w-7xl flex-1 flex-col">{children}</main>
			</SidebarInset>
		</SidebarProvider>
	)
}
