# Plano 005: Leitores de extrato sem inversão de sinal, sem fundir compras iguais e com valores BR corretos

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- src/lib/statements/csv.ts src/lib/statements/ofx.ts`
> Confira os trechos de "Estado atual" direto nos arquivos (havia mudanças não commitadas).

## Status

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: MED (mudar geração de id pode duplicar transações já importadas — ver passo 2)
- **Depende de**: plans/002-testes-leitores-e-dinheiro.md (os testes com comentário `BUG conhecido — muda no plano 005` são invertidos aqui)
- **Categoria**: bug
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

Três defeitos produzem valores errados sem nenhum aviso:
1. Na coluna "Tipo"/"Natureza" de um CSV genérico, qualquer valor que comece com "c" vira
   ENTRADA e com "d" vira SAÍDA — "Compra", "Cartão", "Cobrança" contam como receita;
   "Depósito", "Devolução" contam como gasto.
2. No OFX sem `<FITID>`, duas compras idênticas no mesmo dia recebem o mesmo id e a segunda é
   descartada como "duplicada" ao salvar (`skipDuplicates` + `@@unique([accountId, externalId])`).
3. No CSV, `"1.234"` (milhar brasileiro sem centavos) vira 1,234 (erro de mil vezes); `"10,00-"`
   (sinal no fim, usado por alguns bancos) é descartado; um campo entre aspas com quebra de
   linha quebra a linha inteira.

## Estado atual

- `src/lib/statements/csv.ts:~240-250` (`amountFromRow`):
  ```ts
  // Coluna "Tipo" com D/C ou Débito/Crédito define o sinal
  const kind = normalize(row[columns.kind] ?? '')
  if (/^(d|debito|saida)/.test(kind)) return -Math.abs(amount)
  if (/^(c|credito|entrada)/.test(kind)) return Math.abs(amount)
  return amount
  ```
  `normalize` deixa minúsculo e sem acento. A coluna `kind` casa cabeçalhos
  `['tipo', 'natureza', 'd c', 'dc', 'c d', 'cd', 'tipo lancamento']` (`csv.ts:~148`).
- `src/lib/statements/csv.ts:~47-70` (`parseAmount`, privada):
  ```ts
  let clean = value.replace(/R\$|\s/g, '')
  if (!clean) return null
  let sign = 1
  if (/^\(.*\)$/.test(clean)) { sign = -1; clean = clean.slice(1, -1) }
  if (/[Dd]$/.test(clean)) { sign = -1; clean = clean.slice(0, -1) }
  else if (/[Cc]$/.test(clean)) { clean = clean.slice(0, -1) }
  // Vírgula depois do último ponto = decimal brasileiro
  const amount = clean.lastIndexOf(',') > clean.lastIndexOf('.')
  	? Number(clean.replace(/\./g, '').replace(',', '.'))
  	: Number(clean.replace(/,/g, ''))
  return Number.isFinite(amount) ? sign * amount : null
  ```
- `src/lib/statements/csv.ts:~264-265` (`parseCsv`): `const lines = content.split(/\r?\n/).filter((line) => line.trim())`
  — divide em linhas ANTES de considerar aspas. `splitLine(line, separator)` (`csv.ts:4-19`)
  já respeita aspas dentro de uma linha.
- `src/lib/statements/ofx.ts:~66-76`:
  ```ts
  for (const block of blocks(content, 'STMTTRN')) {
  	const date = parseDate(tag(block, 'DTPOSTED'))
  	const amount = parseAmount(tag(block, 'TRNAMT'))
  	if (!date || amount === null) continue
  	const description = tag(block, 'MEMO') ?? tag(block, 'NAME') ?? 'Sem descrição'
  	const externalId =
  		tag(block, 'FITID') ?? `${date.toISOString().slice(0, 10)}|${amount}|${description}`
  	transactions.push({ externalId, date, amount, description })
  }
  ```
- Ids já gravados no banco usam o formato atual. **Compatibilidade obrigatória**: a 1ª
  ocorrência de cada chave tem que continuar gerando exatamente o id de hoje; só a 2ª, 3ª…
  ganham sufixo. Assim, reimportar um arquivo antigo não duplica nada.
- Testes existentes (do plano 002): `src/lib/statements/csv.test.ts` e `ofx.test.ts`, com casos
  marcados `// BUG conhecido — muda no plano 005`.

## Comandos que você vai usar

| Propósito | Comando | Esperado |
|---|---|---|
| Testes dos leitores | `bun test src/lib/statements` | todos passam |
| Tudo | `bun run check` | exit 0 |

## Escopo

**Dentro do escopo**: `src/lib/statements/csv.ts`, `src/lib/statements/ofx.ts`,
`src/lib/statements/csv.test.ts`, `src/lib/statements/ofx.test.ts`.

**Fora do escopo**: `hashIds` (fórmula do id do CSV — não mude), `save.ts`, o schema do
Prisma, os leitores de PDF (`itau-pdf.ts`, `itau-card-pdf.ts`), dados já gravados no banco.

## Fluxo de git

Não commite, não faça stash nem checkout. Se instruído: `fix: ...` em pt-BR, só estes arquivos.

## Passos

### Passo 1: Coluna "Tipo" só com tokens exatos

Troque os dois regex por conjuntos exatos (a string já está normalizada):
```ts
const DEBIT_KINDS = new Set(['d', 'db', 'deb', 'debito', 'saida'])
const CREDIT_KINDS = new Set(['c', 'cr', 'cred', 'credito', 'entrada'])
if (DEBIT_KINDS.has(kind)) return -Math.abs(amount)
if (CREDIT_KINDS.has(kind)) return Math.abs(amount)
return amount
```
No `csv.test.ts`, inverta o caso `Tipo = Compra`: agora o valor fica como está no arquivo
(`+50` se o arquivo diz `50,00`); acrescente `Tipo = Débito` → negativo e `Tipo = C` → positivo.

**Verificar**: `bun test src/lib/statements/csv.test.ts` → todos passam.

### Passo 2: OFX sem FITID com contador de ocorrência (compatível)

```ts
const seen = new Map<string, number>()
// dentro do loop, quando não houver FITID:
const key = `${date.toISOString().slice(0, 10)}|${amount}|${description}`
const occurrence = seen.get(key) ?? 0
seen.set(key, occurrence + 1)
const externalId = tag(block, 'FITID') ?? (occurrence === 0 ? key : `${key}|${occurrence}`)
```
No `ofx.test.ts`, inverta o caso do par sem FITID: ids diferentes, o primeiro igual a
`'YYYY-MM-DD|amount|description'` exatamente como antes.

**Verificar**: `bun test src/lib/statements/ofx.test.ts` → todos passam.

### Passo 3: `parseAmount` para milhar BR e sinal no fim

Antes da decisão de decimal:
1. Sinal no fim: se `clean` termina com `-`, `sign = -1` e remova o `-`.
2. Milhar BR sem decimais: se `clean` casa `/^\d{1,3}(\.\d{3})+$/`, devolva
   `sign * Number(clean.replace(/\./g, ''))`.
Mantenha todo o resto igual. No `csv.test.ts`, inverta o caso `"1.234"` → `1234` e acrescente
`"10,00-"` → `-10`, `"1.234.567"` → `1234567`, `"12.50"` → `12.5` (ponto decimal com 2 casas
continua decimal), `"1,234.56"` → `1234.56`.

**Verificar**: `bun test src/lib/statements/csv.test.ts` → todos passam.

### Passo 4: Quebra de linha dentro de aspas

Substitua o `content.split(/\r?\n/)` por um divisor de registros que ignora quebras dentro de
aspas:
```ts
function splitRecords(content: string): string[] {
	const records: string[] = []
	let current = ''
	let quoted = false
	for (let i = 0; i < content.length; i++) {
		const char = content[i]
		if (char === '"') quoted = !quoted
		if (!quoted && (char === '\n' || char === '\r')) {
			if (char === '\r' && content[i + 1] === '\n') i++
			records.push(current)
			current = ''
			continue
		}
		current += char
	}
	records.push(current)
	return records
}
// parseCsv: const lines = splitRecords(content).filter((line) => line.trim())
```
Teste novo: CSV genérico com uma descrição `"Linha 1\nLinha 2"` entre aspas → 1 transação, com
a descrição contendo a quebra (ou espaço — registre o que sair; o importante é não perder a linha).

**Verificar**: `bun test src/lib/statements` → todos passam; `bun run check` → exit 0.

## Critérios de pronto

- [ ] `bun run check` sai 0
- [ ] `grep -n "BUG conhecido — muda no plano 005" src/lib/statements/*.test.ts` → nenhuma linha (todas resolvidas)
- [ ] O teste de "id exato" do `hashIds` do plano 002 continua passando SEM alteração
- [ ] Teste de OFX prova que a 1ª ocorrência mantém o id antigo
- [ ] Linha do plano 005 em `plans/README.md` atualizada

## Condições de PARADA

- O teste de id exato do `hashIds` (plano 002) quebrar — significa que a fórmula do id mudou.
- Algum arquivo real do dono (Nubank CSV/OFX) usar a coluna "tipo" com valores que não estão
  nos conjuntos acima — não adivinhe; reporte (não abra a pasta `extratos/`, só pergunte).
- O plano 002 não foi executado (não há testes para inverter).

## Notas de manutenção

- Novos bancos com coluna D/C diferente: acrescente o token ao conjunto, com teste.
- A regra "1ª ocorrência mantém o id antigo" deve valer para qualquer mudança futura de id.
