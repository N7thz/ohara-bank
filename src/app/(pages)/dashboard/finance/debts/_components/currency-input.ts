// "1.234,56" → 1234.56
export function parseCurrency(value: string) {
	const number = Number(value.replace(/\./g, '').replace(',', '.'))
	return Number.isFinite(number) ? number : Number.NaN
}

// 1234.56 → "1234,56"
export function currencyInput(value: number) {
	return value.toFixed(2).replace('.', ',')
}

/** Deixa só dígitos, ponto e vírgula enquanto a pessoa digita */
export function formatCurrencyInput(value: string) {
	return value.replace(/[^\d.,]/g, '')
}
