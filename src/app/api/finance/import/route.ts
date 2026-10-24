import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { parsePayslip } from '@/lib/payslips'
import { savePayslip } from '@/lib/payslips/save'
import { isPdf } from '@/lib/pdf'
import { MissingAccountInfoError, type ParsedStatement, parseStatement } from '@/lib/statements'
import { parseItauStatementPdf } from '@/lib/statements/itau-pdf'
import { saveStatement } from '@/lib/statements/save'

const MAX_FILE_SIZE = 5 * 1024 * 1024

const optionsSchema = z.object({
	bankName: z.string().trim().min(1).max(60).optional(),
	type: z.enum(['CHECKING', 'CREDIT_CARD']).optional(),
})

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

	let statement: ParsedStatement | null = null

	if (isPdf(buffer)) {
		// PDF: extrato do Itaú vira transações; os demais são tratados como holerite
		try {
			statement = await parseItauStatementPdf(buffer)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'PDF inválido'
			return NextResponse.json({ error: message }, { status: 400 })
		}

		if (!statement) {
			let parsed: Awaited<ReturnType<typeof parsePayslip>>
			try {
				parsed = await parsePayslip(buffer)
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

	const { account, imported, duplicates } = await saveStatement(session.user.id, statement)

	return NextResponse.json(
		{
			kind: 'statement',
			accountId: account.id,
			bankName: account.bankName,
			imported,
			duplicates,
		},
		{ status: 201 },
	)
}
