import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { QueryProvider } from '@/components/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { DotPattern } from '@/components/ui/dot-pattern'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// Texto usa a fonte do sistema (DESIGN.md); a mono fica para valores técnicos
const jetbrainsMono = JetBrains_Mono({
	variable: '--font-jetbrains-mono',
	subsets: ['latin'],
})

export const metadata: Metadata = {
	title: {
		template: '%s | Ohara Bank',
		default: 'Ohara Bank',
	},
	description: 'Finanças pessoais: extratos, holerites, tags e resumos.',
	applicationName: 'Ohara Bank',
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<>
			<html lang="pt-BR" suppressHydrationWarning>
				<head />
				<body className={`${jetbrainsMono.variable} relative`}>
					<QueryProvider>
						<ThemeProvider attribute="class" defaultTheme="system">
							<DotPattern className="fixed -z-10 text-foreground/15" />
							{children}
							<Toaster />
						</ThemeProvider>
					</QueryProvider>
				</body>
			</html>
		</>
	)
}
