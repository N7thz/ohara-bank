// Começo de célula que o Excel/LibreOffice interpreta como fórmula
const FORMULA_START = /^[=+\-@\t\r]/

/** Célula de CSV com ";" como separador: aspas quando precisa */
export function csvCell(value: string) {
	return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Célula de TEXTO vindo de dados externos: neutraliza fórmula com um apóstrofo na frente */
export function csvTextCell(value: string) {
	return csvCell(FORMULA_START.test(value) ? `'${value}` : value)
}
