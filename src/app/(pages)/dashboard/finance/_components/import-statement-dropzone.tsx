'use client'

import { isAxiosError } from 'axios'
import { UploadIcon } from 'lucide-react'
import { type DragEvent, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { ImportInput, ImportResult } from '@/hooks/finance/import'
import { useImportStatement } from '@/hooks/finance/import'
import { formatCompetence } from '@/lib/format'
import { cn } from '@/lib/utils'
import { AccountInfoDialog } from './account-info-dialog'

type AccountInfo = Pick<ImportInput, 'bankName' | 'type'>

const ACCEPTED_EXTENSIONS = ['.ofx', '.csv', '.pdf']

function isAccepted(file: File) {
	const name = file.name.toLowerCase()
	return ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))
}

export function ImportStatementDropzone() {
	const inputRef = useRef<HTMLInputElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	// CSV genérico aguardando o usuário dizer banco e tipo
	const [pending, setPending] = useState<{
		file: File
		resolve: (info: AccountInfo | null) => void
	} | null>(null)

	const { mutateAsync: importStatement, isPending } = useImportStatement()
	const isBusy = isPending || !!pending

	function askAccountInfo(file: File) {
		return new Promise<AccountInfo | null>((resolve) => setPending({ file, resolve }))
	}

	function notify(result: ImportResult) {
		if (result.kind === 'payslip') {
			const month = formatCompetence(result.competence)
			if (result.created) toast.success(`Holerite ${month} de ${result.employerName} importado`)
			else toast.info(`Holerite ${month} de ${result.employerName} já tinha sido importado`)
			return
		}

		toast.success(
			`${result.bankName}: ${result.imported} transações importadas` +
				(result.duplicates > 0 ? ` (${result.duplicates} já existiam)` : ''),
		)
	}

	async function importFile(file: File) {
		try {
			notify(await importStatement({ file }))
		} catch (error) {
			const data = isAxiosError(error) ? error.response?.data : null

			if (data?.code === 'NEEDS_ACCOUNT_INFO') {
				const info = await askAccountInfo(file)
				if (!info) return

				try {
					notify(await importStatement({ file, ...info }))
				} catch (retryError) {
					const message = isAxiosError(retryError) ? retryError.response?.data?.error : null
					toast.error(`${file.name}: ${message ?? 'erro ao importar'}`)
				}
				return
			}

			toast.error(`${file.name}: ${data?.error ?? 'erro ao importar'}`)
		}
	}

	async function handleFiles(files: FileList | null) {
		if (!files) return

		// O atributo accept não vale para arquivos soltos na área
		const all = Array.from(files)
		const accepted = all.filter(isAccepted)
		for (const file of all.filter((file) => !isAccepted(file))) {
			toast.error(`${file.name}: formato não suportado (use OFX, CSV ou PDF)`)
		}

		// Um por vez: o diálogo de banco/tipo pode aparecer para cada CSV
		for (const file of accepted) {
			await importFile(file)
		}

		if (inputRef.current) inputRef.current.value = ''
	}

	function handleDragOver(event: DragEvent<HTMLLabelElement>) {
		event.preventDefault()
		if (!isBusy) setIsDragging(true)
	}

	function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
		// Ignora a saída para elementos filhos da própria área
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
		setIsDragging(false)
	}

	function handleDrop(event: DragEvent<HTMLLabelElement>) {
		event.preventDefault()
		setIsDragging(false)
		if (!isBusy) handleFiles(event.dataTransfer.files)
	}

	function closeDialog(info: AccountInfo | null) {
		pending?.resolve(info)
		setPending(null)
	}

	return (
		<>
			<label
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				aria-disabled={isBusy}
				className={cn(
					'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
					'hover:border-primary/50 hover:bg-muted/50 has-focus-visible:ring-2 has-focus-visible:ring-ring',
					isDragging && 'border-primary bg-primary/5',
					isBusy && 'pointer-events-none opacity-60',
				)}
			>
				<input
					ref={inputRef}
					type="file"
					accept={ACCEPTED_EXTENSIONS.join(',')}
					multiple
					disabled={isBusy}
					className="sr-only"
					onChange={(event) => handleFiles(event.target.files)}
				/>
				<UploadIcon className="size-6 text-muted-foreground" />
				<span className="text-sm font-medium">
					{isPending
						? 'Importando...'
						: isDragging
							? 'Solte os arquivos para importar'
							: 'Arraste extratos aqui ou clique para selecionar'}
				</span>
				<span className="text-xs text-muted-foreground">
					Extrato em OFX, CSV ou PDF do Itaú, holerite em PDF · até 5 MB cada
				</span>
			</label>

			<AccountInfoDialog
				fileName={pending?.file.name ?? null}
				onConfirm={(info) => closeDialog(info)}
				onCancel={() => closeDialog(null)}
			/>
		</>
	)
}
