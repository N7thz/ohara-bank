import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/api-session'
import { checkEmails } from '@/lib/email/scheduler'
import { parsePayslipRows } from '@/lib/payslips'
import { savePayslip } from '@/lib/payslips/save'
import { groupRows, isPdf, PdfPasswordError, readPdfItems } from '@/lib/pdf'
import { MissingAccountInfoError, type ParsedStatement, parseStatement } from '@/lib/statements'
import { parseItauStatementItems } from '@/lib/statements/itau-pdf'
import { saveStatement } from '@/lib/statements/save'

const MAX_FILE_SIZE = 5 * 1024 * 1024

const optionsSchema = z.object({
	bankName: z.string().trim().min(1).max(60).optional(),
	type: z.enum(['CHECKING', 'CREDIT_CARD']).optional(),
})

/** PDF com senha: a tela pede a senha e reenvia o arquivo */
function passwordResponse(error: PdfPasswordError) {
	return NextResponse.json(
		{ error: error.message, needsPassword: true, wrongPassword: error.wrongPassword },
		{ status: 400 },
	)
}

export async function POST(request: Request) {
	const { session, response } = await requireSession(request)
	if (!session) return response

	// O formulário inclui o arquivo e alguns campos: folga de 64 KB sobre o limite do arquivo
	const declared = Number(request.headers.get('content-length') ?? 0)
	if (declared > MAX_FILE_SIZE + 64 * 1024) {
		return NextResponse.json({ error: 'Arquivo maior que 5 MB' }, { status: 413 })
	}

	const formData = await request.formData()
	const file = formData.get('file')

	if (!(file instanceof File)) {
		return NextResponse.json({ error: 'Envie um arquivo no campo "file"' }, { status: 400 })
	}
	if (file.size > MAX_FILE_SIZE) {
		return NextResponse.json({ error: 'Arquivo maior que 5 MB' }, { status: 400 })
	}

	const buffer = await file.arrayBuffer()
	// Só para PDF com senha (fatura do cartão Itaú: 5 primeiros dígitos do CPF)
	const passwordField = formData.get('password')
	const password =
		typeof passwordField === 'string' && passwordField.trim()
			? passwordField.trim().slice(0, 64)
			: undefined

	let statement: ParsedStatement | null = null

	if (isPdf(buffer)) {
		// PDF: extrato do Itaú vira transações; os demais são tratados como holerite.
		// O arquivo é lido uma vez só
		let items: Awaited<ReturnType<typeof readPdfItems>>
		try {
			items = await readPdfItems(buffer, password)
		} catch (error) {
			if (error instanceof PdfPasswordError) return passwordResponse(error)
			const message = error instanceof Error ? error.message : 'PDF inválido'
			return NextResponse.json({ error: message }, { status: 400 })
		}

		try {
			statement = parseItauStatementItems(items)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'PDF inválido'
			return NextResponse.json({ error: message }, { status: 400 })
		}

		if (!statement) {
			let parsed: ReturnType<typeof parsePayslipRows>
			try {
				parsed = parsePayslipRows(items.map(groupRows))
			} catch (error) {
				const message = error instanceof Error ? error.message : 'PDF inválido'
				return NextResponse.json({ error: message }, { status: 400 })
			}

			const { payslip, created } = await savePayslip(session.user.id, parsed)

			return NextResponse.json(
				{
					kind: 'payslip',
					payslipId: payslip.id,
					employerName: payslip.employerName,
					competence: payslip.competence,
					created,
				},
				{ status: created ? 201 : 200 },
			)
		}
	} else {
		const options = optionsSchema.safeParse({
			bankName: formData.get('bankName') || undefined,
			type: formData.get('type') || undefined,
		})
		if (!options.success) {
			return NextResponse.json({ error: 'Banco ou tipo de conta inválido' }, { status: 400 })
		}

		try {
			statement = parseStatement(buffer, { ...options.data, fileName: file.name })
		} catch (error) {
			// CSV genérico: o cliente pergunta banco e tipo e envia de novo
			if (error instanceof MissingAccountInfoError) {
				return NextResponse.json(
					{ error: error.message, code: 'NEEDS_ACCOUNT_INFO' },
					{ status: 422 },
				)
			}
			const message = error instanceof Error ? error.message : 'Arquivo inválido'
			return NextResponse.json({ error: message }, { status: 400 })
		}
	}

	if (statement.transactions.length === 0) {
		return NextResponse.json({ error: 'Nenhuma transação encontrada no arquivo' }, { status: 400 })
	}

	const { account, imported, duplicates, untagged } = await saveStatement(
		session.user.id,
		statement,
	)

	// Extrato novo pode completar um resumo ou atrasar uma conta: verifica os e-mails sem esperar
	if (imported > 0) after(() => checkEmails({ userId: session.user.id }))

	return NextResponse.json(
		{
			kind: 'statement',
			accountId: account.id,
			bankName: account.bankName,
			imported,
			duplicates,
			untagged,
		},
		{ status: 201 },
	)
}
