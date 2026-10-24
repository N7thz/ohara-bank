// O template remonta a cada navegação: a página nova entra com fade + slide
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
	return <div className="animate-page flex flex-1 flex-col">{children}</div>
}
