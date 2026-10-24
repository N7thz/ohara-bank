// Remonta ao trocar entre Finanças, Transações e Dívidas (o template de /dashboard não vê essa troca)
export default function FinanceTemplate({ children }: { children: React.ReactNode }) {
	return <div className="animate-page flex flex-1 flex-col">{children}</div>
}
