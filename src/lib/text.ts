// "Café" e "CAFE" casam com a regra "cafe". Sem dependência de banco: serve em teste e no cliente
export function normalizeText(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.trim()
}
