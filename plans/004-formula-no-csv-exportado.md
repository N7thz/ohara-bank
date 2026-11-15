# Plano 004: O CSV exportado não executa fórmulas quando aberto no Excel

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- src/app/api/finance/transactions/export/route.ts`
> O arquivo estava não commitado quando o plano foi escrito; confira o trecho de "Estado atual"
> direto no arquivo. Se o plano 003 já rodou, o bloco de sessão estará trocado por
> `requireSession` — isso é esperado e não é deriva.

## Status

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: LOW
- **Depende de**: plans/001-verificacao-base.md
- **Categoria**: security
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

A exportação de transações gera um CSV para abrir no Excel. As descrições vêm de extratos
bancários e incluem texto escrito por terceiros (o nome que outra pessoa põe num Pix). Uma
célula que começa com `=`, `+`, `-`, `@`, tab ou retorno de carro é interpretada como fórmula
pelo Excel/LibreOffice — uma fórmula como `=HYPERLINK(...)` ou `=WEBSERVICE(...)` pode enviar
os dados financeiros das outras células para fora. A correção é prefixar `'` nas colunas de
TEXTO; a coluna de valor (que legitimamente começa com `-`) não pode ser alterada.

## Estado atual

`src/app/api/finance/transactions/export/route.ts` (inteiro tem 65 linhas):
```ts
// linha 10
// Excel em português espera ";" entre colunas e vírgula decimal
const SEPARATOR = ';'

function cell(value: string) {
	return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}
// linhas 41-56
const header = ['Data', 'Descrição', 'Valor', 'Conta', 'Tags', 'Fora dos totais']
const rows = transactions.map((tx) => {
	const [year, month, day] = tx.date.toISOString().slice(0, 10).split('-')
	return [
		`${day}/${month}/${year}`,
		tx.description,
		tx.amount.toFixed(2).replace('.', ','),
		`${tx.account.bankName} ${tx.account.number}`,
		tx.tags.map(({ tag }) => tag.name).join(', '),
		tx.tags.some(({ tag }) => tag.excludeFromTotals) ? 'sim' : 'não',
	]
})
// BOM para o Excel reconhecer UTF-8 e mostrar os acentos
const csv = `﻿${[header, ...rows].map((row) => row.map(cell).join(SEPARATOR)).join('\r\n')}\r\n`
```
Colunas de texto vindas de dados: índice 1 (descrição), 3 (conta), 4 (tags). A coluna 2 (valor)
é gerada pelo próprio código e PRECISA continuar começando com `-` quando negativa.

## Comandos que você vai usar

| Propósito | Comando | Esperado |
|---|---|---|
| Teste | `bun test src/lib/csv-cell.test.ts` | todos passam |
| Tudo | `bun run check` | exit 0 |

## Escopo

**Dentro do escopo**:
- `src/lib/csv-cell.ts` (criar — função pura, testável sem banco)
- `src/lib/csv-cell.test.ts` (criar)
- `src/app/api/finance/transactions/export/route.ts`

**Fora do escopo**: o formato do arquivo (separador `;`, BOM, cabeçalho, vírgula decimal), a
consulta ao banco, qualquer outra rota.

## Fluxo de git

Não commite, não faça stash nem checkout. Se instruído: `fix: ...` em pt-BR, só estes arquivos.

## Passos

### Passo 1: Função pura em `src/lib/csv-cell.ts`

```ts
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
```

**Verificar**: `bun run typecheck` → exit 0.

### Passo 2: Usar na rota

Em `export/route.ts`: apague a função local `cell`, importe `csvCell`/`csvTextCell` de
`@/lib/csv-cell`, e monte cada linha aplicando `csvTextCell` aos índices 1, 3 e 4 e `csvCell`
aos demais (o cabeçalho usa `csvCell`). Exemplo de forma:
```ts
const TEXT_COLUMNS = new Set([1, 3, 4])
const line = (row: string[], isHeader = false) =>
	row.map((value, i) => (!isHeader && TEXT_COLUMNS.has(i) ? csvTextCell(value) : csvCell(value))).join(SEPARATOR)
```

**Verificar**: `bun run typecheck` → exit 0; `grep -n "function cell" src/app/api/finance/transactions/export/route.ts` → nada.

### Passo 3: Testes

`src/lib/csv-cell.test.ts` com `test.each` para `csvTextCell`:
`'=HYPERLINK("x")'` → `"'=HYPERLINK(""x"")"` (com aspas, porque contém `"`);
`'+55 11'` → `"'+55 11"`; `'-PIX'` → `"'-PIX'"`... (confira: resultado `'-PIX` sem aspas);
`'@SUM(A1)'` → `"'@SUM(A1)"`; `'\tX'` → `"'\tX"`; `'Padaria'` → `'Padaria'`;
`'a;b'` → `'"a;b"'`. E para `csvCell`: `'-10,50'` → `'-10,50'` (valor negativo intacto).

**Verificar**: `bun test src/lib/csv-cell.test.ts` → todos passam.

### Passo 4: Portão final

**Verificar**: `bun run check` → exit 0.

## Critérios de pronto

- [ ] `bun run check` sai 0
- [ ] `src/lib/csv-cell.test.ts` cobre os 5 caracteres de gatilho e o valor negativo intacto
- [ ] Só os 3 arquivos do escopo mudaram
- [ ] Linha do plano 004 em `plans/README.md` atualizada

## Condições de PARADA

- O trecho de "Estado atual" não bate (a rota mudou de formato).
- Algum teste exigir mudar a coluna de valor.

## Notas de manutenção

- Qualquer nova coluna de texto vinda de dados externos deve usar `csvTextCell`.
- O apóstrofo aparece no conteúdo da célula em alguns programas; é o preço aceito da proteção
  (padrão OWASP "CSV Injection").
