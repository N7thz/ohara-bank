import { describe, expect, test } from 'bun:test'
import { isOfx, parseOfx } from './ofx'

const transaction = (fields: string) => `<STMTTRN>${fields}</STMTTRN>`

const OFX = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>0260<ACCTID>123456-7</BANKACCTFROM>
<BANKTRANLIST>
${transaction('<TRNTYPE>DEBIT<DTPOSTED>20260901000000[-3:BRT]<TRNAMT>-25.50<FITID>fit-1<MEMO>Padaria Exemplo')}
${transaction('<TRNTYPE>CREDIT<DTPOSTED>20260902000000[-3:BRT]<TRNAMT>100.00<FITID>fit-2<MEMO>Pix recebido')}
${transaction('<TRNTYPE>DEBIT<DTPOSTED>20260903000000[-3:BRT]<TRNAMT>-8.00<MEMO>Cafe')}
${transaction('<TRNTYPE>DEBIT<DTPOSTED>20260903000000[-3:BRT]<TRNAMT>-8.00<MEMO>Cafe')}
</BANKTRANLIST>
<LEDGERBAL><BALAMT>500.00<DTASOF>20260903000000</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

describe('OFX', () => {
	test('reconhece o formato', () => {
		expect(isOfx(OFX)).toBe(true)
		expect(isOfx('Data,Valor\n01/01/2026,10')).toBe(false)
	})

	const statement = parseOfx(OFX)

	test('banco pelo código e conta pelo ACCTID', () => {
		expect(statement.bankName).toBe('Nubank')
		expect(statement.number).toBe('123456-7')
		expect(statement.type).toBe('CHECKING')
	})

	test('usa o FITID como id', () => {
		expect(statement.transactions.slice(0, 2).map((tx) => tx.externalId)).toEqual([
			'fit-1',
			'fit-2',
		])
		expect(statement.transactions[0].amount).toBe(-25.5)
	})

	test('sem FITID, compras iguais no mesmo dia têm ids diferentes; a 1ª mantém o formato antigo', () => {
		const [first, second] = statement.transactions.slice(2)
		expect(first.externalId).toBe('2026-09-03|-8|Cafe')
		expect(second.externalId).toBe('2026-09-03|-8|Cafe|1')
	})
})
