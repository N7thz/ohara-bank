export type AccountType = 'CHECKING' | 'CREDIT_CARD'

export interface ParsedTransaction {
	externalId: string
	date: Date
	/** Negativo = saída, positivo = entrada */
	amount: number
	description: string
}

export interface ParsedStatement {
	bankName: string
	number: string
	type: AccountType
	balance: number | null
	balanceDate: Date | null
	transactions: ParsedTransaction[]
}

/** Dados que o CSV genérico não traz e o usuário informa na importação */
export interface StatementOptions {
	bankName?: string
	type?: AccountType
	number?: string
	/** Nome do arquivo enviado; o do Nubank traz o número da conta */
	fileName?: string
}
