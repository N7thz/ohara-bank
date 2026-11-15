import { runEmailJobs } from './jobs'

// Roda dentro do servidor Next (instrumentation.ts): só envia enquanto o app está aberto.
// Os e-mails não se repetem, então ao abrir o app depois de um tempo os atrasados saem

const INTERVAL_MS = 15 * 60 * 1000
/** Espera o servidor subir antes da primeira verificação */
const FIRST_RUN_MS = 60 * 1000

// No dev, o módulo recarrega: o timer fica no global para não duplicar
const globalForScheduler = globalThis as unknown as {
	emailScheduler?: NodeJS.Timeout
	emailRunning?: boolean
}

export async function checkEmails(options?: Parameters<typeof runEmailJobs>[0]) {
	// Uma verificação por vez: a importação e o timer podem coincidir
	if (globalForScheduler.emailRunning) return []
	globalForScheduler.emailRunning = true
	try {
		const results = await runEmailJobs(options)
		for (const result of results) {
			if (result.error) console.error(`[e-mail] falhou "${result.subject}": ${result.error}`)
			else console.log(`[e-mail] enviado "${result.subject}"`)
		}
		return results
	} catch (error) {
		console.error('[e-mail] erro ao verificar e-mails', error)
		return []
	} finally {
		globalForScheduler.emailRunning = false
	}
}

export function startEmailScheduler() {
	if (globalForScheduler.emailScheduler) return
	globalForScheduler.emailScheduler = setInterval(() => void checkEmails(), INTERVAL_MS)
	setTimeout(() => void checkEmails(), FIRST_RUN_MS)
}
