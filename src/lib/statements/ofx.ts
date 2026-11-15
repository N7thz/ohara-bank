import type { ParsedStatement, ParsedTransaction } from './types'

// Código COMPE → nome. Usado quando o OFX não traz <ORG>.
const BANK_CODES: Record<string, string> = {
	'1': 'Banco do Brasil',
	'33': 'Santander',
	'77': 'Inter',
	'104': 'Caixa',
	'208': 'BTG Pactual',
	'237': 'Bradesco',
	'260': 'Nubank',
	'290': 'PagBank',
	'336': 'C6 Bank',
	'341': 'Itaú',
	'380': 'PicPay',
	'756': 'Sicoob',
	'748': 'Sicredi',
}

// Funciona para OFX 1.x (SGML, sem tags de fechamento) e 2.x (XML)
function tag(block: string, name: string): string | null {
	const match = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'))
	const value = match?.[1]?.trim()
	return value ? value : null
}

function blocks(content: string, name: string): string[] {
	return content.match(new RegExp(`<${name}>[\\s\\S]*?</${name}>`, 'gi')) ?? []
}

// 20261015120000[-3:BRT] → 2026-10-15 (UTC, só a data importa)
function parseDate(value: string | null): Date | null {
	const match = value?.match(/^(\d{4})(\d{2})(\d{2})/)
	if (!match) return null
	return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

function parseAmount(value: string | null): number | null {
	if (!value) return null
	const amount = Number(value.replace(/\s/g, '').replace(',', '.'))
	return Number.isFinite(amount) ? amount : null
}

export function isOfx(content: string): boolean {
	return /OFXHEADER|<OFX>/i.test(content.slice(0, 2000))
}

export function parseOfx(content: string): ParsedStatement {
	const isCreditCard = /<CCSTMTRS>/i.test(content)

	const bankId = tag(content, 'BANKID')
	const bankCode = bankId ? String(Number(bankId)) : null
	const bankName =
		(bankCode && BANK_CODES[bankCode]) ??
		tag(content, 'ORG') ??
		(bankId ? `Banco ${bankId}` : 'Banco desconhecido')

	const number = tag(content, 'ACCTID') ?? (isCreditCard ? 'cartao' : 'conta')

	const ledger = blocks(content, 'LEDGERBAL')[0] ?? ''
	const balance = parseAmount(tag(ledger, 'BALAMT'))
	const balanceDate = parseDate(tag(ledger, 'DTASOF'))

	const transactions: ParsedTransaction[] = []
	// Sem FITID: compras iguais no mesmo dia ganham a ocorrência no id. A primeira mantém o id
	// antigo, para reimportar um arquivo já importado não duplicar nada
	const seen = new Map<string, number>()

	for (const block of blocks(content, 'STMTTRN')) {
		const date = parseDate(tag(block, 'DTPOSTED'))
		const amount = parseAmount(tag(block, 'TRNAMT'))
		if (!date || amount === null) continue

		const description = tag(block, 'MEMO') ?? tag(block, 'NAME') ?? 'Sem descrição'
		const key = `${date.toISOString().slice(0, 10)}|${amount}|${description}`
		const occurrence = seen.get(key) ?? 0
		seen.set(key, occurrence + 1)
		const externalId = tag(block, 'FITID') ?? (occurrence === 0 ? key : `${key}|${occurrence}`)

		transactions.push({ externalId, date, amount, description })
	}

	return {
		bankName,
		number,
		type: isCreditCard ? 'CREDIT_CARD' : 'CHECKING',
		// Fatura de cartão: saldo é dívida, não saldo da conta
		balance: isCreditCard ? null : balance,
		balanceDate: isCreditCard ? null : balanceDate,
		transactions,
	}
}
