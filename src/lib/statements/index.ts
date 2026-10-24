import { parseCsv } from './csv'
import { isOfx, parseOfx } from './ofx'
import type { StatementOptions } from './types'

export { MissingAccountInfoError } from './csv'
export type { AccountType, ParsedStatement, ParsedTransaction, StatementOptions } from './types'

// Bancos brasileiros costumam exportar OFX e CSV em windows-1252
function decode(buffer: ArrayBuffer): string {
	const head = new TextDecoder('latin1').decode(buffer.slice(0, 500))
	if (/CHARSET:\s*1252|encoding="(windows-1252|iso-8859-1)"/i.test(head)) {
		return new TextDecoder('windows-1252').decode(buffer)
	}

	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
	} catch {
		return new TextDecoder('windows-1252').decode(buffer)
	}
}

export function parseStatement(buffer: ArrayBuffer, options: StatementOptions = {}) {
	const content = decode(buffer).replace(/^\uFEFF/, '')
	return isOfx(content) ? parseOfx(content) : parseCsv(content, options)
}
