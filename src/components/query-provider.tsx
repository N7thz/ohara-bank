'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						// Os dados só mudam quando a pessoa importa ou edita algo, e essas ações
						// já invalidam o cache; voltar a uma página vista aparece na hora
						staleTime: 5 * 60 * 1000,
						// Páginas visitadas ficam guardadas por 30 min depois de saírem da tela
						gcTime: 30 * 60 * 1000,
						refetchOnWindowFocus: false,
					},
				},
			}),
	)

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
