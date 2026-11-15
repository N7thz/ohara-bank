# Plano 009: Importação recusa arquivo grande antes de ler, limita páginas do PDF e lê o PDF uma vez só

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- src/app/api/finance/import/route.ts src/lib/pdf.ts src/lib/statements/itau-pdf.ts src/lib/payslips/index.ts`
> Confira os trechos de "Estado atual" direto nos arquivos (havia mudanças não commitadas).
> Leia `AGENTS.md`: esta versão do Next.js tem mudanças incompatíveis (docs em `node_modules/next/dist/docs/`).

## Status

- **Prioridade**: P2
- **Esforço**: S
- **Risco**: LOW
- **Depende de**: plans/001-verificacao-base.md
- **Categoria**: security
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

A rota de importação faz `await request.formData()` — que lê o corpo INTEIRO para a memória —
antes de checar o limite de 5 MB; o proxy (`src/proxy.ts`) só cobre `/dashboard/:path*`, então
nada limita o corpo em `/api`. A leitura do PDF percorre todas as páginas sem limite e nunca
libera o documento (`pdf.destroy()`), e um PDF que não é extrato do Itaú é lido DUAS vezes
(primeiro como extrato, depois como holerite). Um arquivo grande ou um PDF com milhares de
páginas trava o servidor. O app roda local hoje, mas a correção é barata.

## Estado atual

- `src/app/api/finance/import/route.ts`: `const MAX_FILE_SIZE = 5 * 1024 * 1024` (topo do
  arquivo); no `POST` (~linha 28 em diante):
  ```ts
  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) { return NextResponse.json({ error: 'Envie um arquivo no campo "file"' }, { status: 400 }) }
  if (file.size > MAX_FILE_SIZE) { return NextResponse.json({ error: 'Arquivo maior que 5 MB' }, { status: 400 }) }
  const buffer = await file.arrayBuffer()
  ...
  if (isPdf(buffer)) {
  	try { statement = await parseItauStatementPdf(buffer, password) } catch (error) { ... }
  	if (!statement) {
  		let parsed: Awaited<ReturnType<typeof parsePayslip>>
  		try { parsed = await parsePayslip(buffer, password) } catch (error) { ... }
  ```
- `src/lib/pdf.ts` — `readPdfItems(buffer, password?)`: abre com
  `getDocumentProxy(new Uint8Array(buffer), password ? { password } : {})` (de `unpdf`),
  converte `PasswordException` em `PdfPasswordError`, e faz
  `for (let number = 1; number <= pdf.numPages; number++)` lendo `page.getTextContent()`.
  `groupRows(items)` agrupa itens em linhas. `readPdfRows(buffer, password?)` = `readPdfItems` + `groupRows`.
- `src/lib/statements/itau-pdf.ts:34-42`:
  ```ts
  export async function parseItauStatementPdf(buffer: ArrayBuffer, password?: string): Promise<ParsedStatement | null> {
  	const items = await readPdfItems(buffer, password)
  	if (isItauCardStatement(items)) return parseItauCardStatement(items)
  	const pages = items.map(groupRows)
  	if (!isItauStatement(pages)) return null
  ```
- `src/lib/payslips/index.ts:~120`:
  ```ts
  export async function parsePayslip(buffer: ArrayBuffer, password?: string): Promise<ParsedPayslip> {
  	const pages = await readPdfRows(buffer, password)
  	const rows = pages[0] ?? []
  	if (!isPayslip(pages)) { throw new Error('PDF não reconhecido: em PDF são aceitos extrato do Itaú e holerite') }
  ```
- Faturas e extratos reais têm de 2 a ~10 páginas; holerites, 1.

## Comandos que você vai usar

| Propósito | Comando | Esperado |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Tudo | `bun run check` | exit 0 |

## Escopo

**Dentro do escopo**: `src/app/api/finance/import/route.ts`, `src/lib/pdf.ts`,
`src/lib/statements/itau-pdf.ts`, `src/lib/payslips/index.ts`.

**Fora do escopo**: as regras de interpretação dos leitores; o formato da resposta da rota
(campos `kind`, `needsPassword`, `wrongPassword`, `untagged` etc. — a tela depende deles);
`next.config.ts`.

## Fluxo de git

Não commite, não faça stash nem checkout. Se instruído: `fix: ...` em pt-BR, só estes arquivos.

## Passos

### Passo 1: Recusar pelo `Content-Length` antes de ler

No início do `POST`, depois da checagem de sessão:
```ts
// O formulário inclui o arquivo e alguns campos: folga de 64 KB sobre o limite do arquivo
const declared = Number(request.headers.get('content-length') ?? 0)
if (declared > MAX_FILE_SIZE + 64 * 1024) {
	return NextResponse.json({ error: 'Arquivo maior que 5 MB' }, { status: 413 })
}
```
Mantenha a checagem `file.size` existente (o cabeçalho pode faltar).

**Verificar**: `bun run typecheck` → exit 0.

### Passo 2: Limite de páginas e liberação do documento

Em `src/lib/pdf.ts`:
- `export const MAX_PDF_PAGES = 50`
- Depois de abrir, `if (pdf.numPages > MAX_PDF_PAGES) throw new Error(\`PDF com mais de ${MAX_PDF_PAGES} páginas não é aceito\`)`.
- Envolva a leitura das páginas em `try { ... } finally { await pdf.destroy() }`. Se `destroy`
  não existir no tipo devolvido por `getDocumentProxy` do `unpdf` instalado, use o método de
  limpeza que existir (`cleanup`) — confira o `.d.ts` do unpdf; se não houver nenhum, pule só
  essa parte e registre no relatório.

**Verificar**: `bun run typecheck` → exit 0.

### Passo 3: Ler o PDF uma vez só

1. `itau-pdf.ts`: separe em `export function parseItauStatementItems(items: PdfItem[][]): ParsedStatement | null`
   (o corpo atual a partir de `if (isItauCardStatement(items))`) e mantenha
   `parseItauStatementPdf(buffer, password)` como `parseItauStatementItems(await readPdfItems(buffer, password))`.
2. `payslips/index.ts`: separe `export function parsePayslipRows(pages: PdfRow[][]): ParsedPayslip`
   (o corpo atual a partir de `const rows = pages[0] ?? []`) e mantenha
   `parsePayslip(buffer, password)` como `parsePayslipRows(await readPdfRows(buffer, password))`.
3. Na rota, no ramo `isPdf(buffer)`: chame `readPdfItems(buffer, password)` UMA vez (tratando
   `PdfPasswordError` com `passwordResponse` como hoje), depois
   `statement = parseItauStatementItems(items)` e, se `null`,
   `parsed = parsePayslipRows(items.map(groupRows))`. Preserve exatamente os mesmos blocos
   `try/catch` e as mesmas respostas de erro.

**Verificar**: `bun run typecheck` → exit 0; `grep -c "readPdfItems\|readPdfRows" src/app/api/finance/import/route.ts` → `1`.

### Passo 4: Portão final

**Verificar**: `bun run check` → exit 0 (os testes de `itau-card-pdf.test.ts` do plano 002, se
existirem, continuam passando).

## Critérios de pronto

- [ ] `bun run check` sai 0
- [ ] A rota responde 413 quando `content-length` passa do limite (confira no código)
- [ ] `src/lib/pdf.ts` tem `MAX_PDF_PAGES` e libera o documento em `finally`
- [ ] Linha do plano 009 em `plans/README.md` atualizada

## Condições de PARADA

- O formato da resposta da rota precisaria mudar.
- Reestruturar a rota exigir mexer em `src/hooks/finance/import.ts` ou na tela de importação.
- `unpdf` não expõe `numPages` antes de ler as páginas.

## Notas de manutenção

- Se um banco mandar extratos com mais de 50 páginas, aumente `MAX_PDF_PAGES` (não remova).
- Adiado: não devolver ao cliente mensagens de erro cruas de bibliotecas (`error.message` do
  pdf.js) — achado de baixa prioridade da auditoria.
