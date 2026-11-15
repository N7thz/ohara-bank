import { normalizeText } from './text'

// Prefixos que o banco põe antes do nome de quem recebeu
const BANK_PREFIXES = [
	/^compra no d[eé]bito( via nupay)? - /i,
	/^transfer[eê]ncia enviada pelo pix( via open banking)? - /i,
	/^pagamento de boleto efetuado - /i,
	// Itaú: "PIX TRANSF MARIA12/06", "PIX QRS CASA DO QUE01/10", "PIX CARTAO ENEL DISTRI0"
	/^pix (transf|qrs|cartao) /i,
]

// Maquininhas e carteiras: "MP *BARBEARIA", "IFD*IFOOD CLUB"
const PROCESSOR_PREFIX = /^[a-z]{1,8} ?\* ?/i

/**
 * Nome de quem recebeu, a partir da descrição do extrato. Só corta pontas, então o
 * resultado continua contido na descrição e serve de busca na lista de transações
 */
export function merchantName(description: string) {
	let name = description
		.trim()
		// Data do Itaú grudada no fim: "MARIA12/06"
		.replace(/\s?\d{2}\/\d{2}$/, '')
		// Pix com cartão no Itaú termina num dígito solto: "ENEL DISTRI0"
		.replace(/^(pix cartao .*\D)\d$/i, '$1')
	for (const prefix of BANK_PREFIXES) name = name.replace(prefix, '')
	name = name
		// Depois do nome vêm CPF/CNPJ, banco e agência
		.split(' - ')[0]
		.replace(/\s*\(.*\)$/, '')
		.replace(PROCESSOR_PREFIX, '')
		// Número da loja: "LOJAS AMERICANAS 278" (mas "99" continua "99")
		.replace(/(\D)\s+\d+$/, '$1')
		.trim()
	return name || description.trim()
}

/** Chave para juntar "UBER" e "Uber" */
export function merchantKey(name: string) {
	return normalizeText(name).replace(/\s+/g, ' ')
}

// "SUPERMERCADO RIO SUL" → "Supermercado Rio Sul"; nomes com minúsculas ficam como estão
export function merchantLabel(name: string) {
	// Sigla curta fica em caixa alta: "IOF"
	if (name !== name.toUpperCase() || /^\S{1,4}$/.test(name)) return name
	return name.toLowerCase().replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase())
}
