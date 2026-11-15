// Roda uma vez quando o servidor sobe: liga o envio de e-mails automáticos
export async function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		const { startEmailScheduler } = await import('@/lib/email/scheduler')
		startEmailScheduler()
	}
}
