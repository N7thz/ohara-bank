'use client'

import { UploadIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { ImportStatementDropzone } from '../finance/_components/import-statement-dropzone'

/** Importar extrato ou holerite de qualquer página do dashboard */
export function ImportButton({ className }: { className?: string }) {
	const [open, setOpen] = useState(false)

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={<Button variant="outline" size="sm" className={className} aria-label="Importar" />}
			>
				<UploadIcon data-icon="inline-start" />
				<span className="hidden sm:inline">Importar</span>
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Importar</DialogTitle>
					<DialogDescription>
						Extrato em OFX, CSV ou PDF do Itaú, ou holerite em PDF.
					</DialogDescription>
				</DialogHeader>
				{/* O diálogo vive no layout: sem fechar, ficaria aberto por cima de Transações */}
				<ImportStatementDropzone onNavigate={() => setOpen(false)} />
			</DialogContent>
		</Dialog>
	)
}
