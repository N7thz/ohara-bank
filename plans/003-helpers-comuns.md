# Plano 003: Um lugar só para datas, para a regra "fora dos totais" e para a checagem de sessão

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- src/lib src/app/api`
> Havia muitas mudanças não commitadas quando o plano foi escrito; confira os trechos de
> "Estado atual" direto nos arquivos. Se não baterem, PARE.

## Status

- **Prioridade**: P2
- **Esforço**: M
- **Risco**: LOW
- **Depende de**: plans/001-verificacao-base.md, plans/002-testes-leitores-e-dinheiro.md (cria `src/lib/text.ts`)
- **Categoria**: tech-debt
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

As mesmas regras estão copiadas em vários arquivos e as cópias já divergem: `day`/`monthKey`
estão definidos em `debts/match.ts`, `summary/route.ts`, `email/jobs.tsx` e `recurring.ts`; a
regra "transação com tag `excludeFromTotals` não conta" está reescrita à mão em
`summary/route.ts` e `email/reports.ts`; e as 27 rotas de API repetem o mesmo bloco de sessão +
401. O plano 007 (fuso horário) precisa trocar o "hoje" em vários lugares — sem um helper
único isso vira uma caça a cópias. Este plano NÃO muda comportamento: só centraliza.

## Estado atual

- `src/lib/debts/match.ts:10-12`:
  ```ts
  export const day = (date: Date) => date.toISOString().slice(0, 10)
  export const monthKey = (date: Date) => date.toISOString().slice(0, 7)
  export const monthStart = (date: Date) => startOfMonth(new UTCDate(date))
  ```
  (`match.ts` importa `prisma`, então quem só quer `monthKey` carrega o banco.)
- `src/lib/recurring.ts:85`: `export const monthKey = (date: Date) => date.toISOString().slice(0, 7)`
- `src/app/api/finance/summary/route.ts:43`: `const day = (date: Date) => date.toISOString().slice(0, 10)`
- `src/lib/email/jobs.tsx:27`: `const TIME_ZONE = 'America/Sao_Paulo'`; linhas ~41-62:
  `const day = …`, `const monthKey = …` e `export function localClock(now: Date)` que devolve
  `{ today: UTCDate à meia-noite UTC do dia em São Paulo, hour: number }` usando
  `Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year, month, day, hour, hourCycle: 'h23' })`.
- Regra "fora dos totais":
  - Filtro Prisma canônico em `src/lib/tags.ts:11-18`: `COUNTS_IN_TOTALS = { tags: { none: { tag: { excludeFromTotals: true } } } }` e `EXCLUDED_FROM_TOTALS`.
  - Reescrita em JS: `src/app/api/finance/summary/route.ts:~123` e `src/lib/email/reports.ts:~41`:
    `if (tx.tags.some(({ tag }) => tag.excludeFromTotals)) …`
  - Filtro Prisma reescrito à mão: `src/lib/email/reports.ts:~96`:
    `tags: { none: { tag: { excludeFromTotals: true } } }` (igual a `COUNTS_IN_TOTALS.tags`).
- Sessão: 27 arquivos em `src/app/api/**/route.ts` repetem, em cada handler:
  ```ts
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
  	return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  ```
  (`auth` vem de `@/lib/auth`.) Exemplo: `src/app/api/finance/tags/route.ts:13-17`.
- `src/lib/transaction-filters.ts` já tem `searchParamsObject(request)` (parâmetros da URL sem
  vazios); `summary/route.ts:~51-53` reimplementa o mesmo inline.

## Comandos que você vai usar

| Propósito | Comando | Esperado |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Testes | `bun test` | todos passam |
| Tudo | `bun run check` | exit 0 |

## Escopo

**Dentro do escopo**:
- Criar `src/lib/dates.ts`, `src/lib/dates.test.ts`, `src/lib/totals.ts`, `src/lib/totals.test.ts`, `src/lib/api-session.ts`
- `src/lib/debts/match.ts`, `src/lib/recurring.ts`, `src/lib/email/jobs.tsx`, `src/lib/email/reports.ts`,
  `src/app/api/finance/summary/route.ts` — só trocar definições locais pelos helpers
- Os 27 `src/app/api/**/route.ts` — só trocar o bloco de sessão (passo 4)

**Fora do escopo**:
- Mudar QUALQUER regra (fuso, meses, o que conta nos totais). O plano 007 muda o fuso.
- Código do cliente em `src/app/(pages)/**` (usa `tag.excludeFromTotals` em memória; fica como está).
- `src/app/api/auth/**` (rota do better-auth — não tem o bloco de sessão; não mexa).

## Fluxo de git

Não commite, não faça stash nem checkout. Se instruído a commitar: `refactor: ...` em pt-BR,
só os arquivos deste plano.

## Passos

### Passo 1: `src/lib/dates.ts` (sem import do Prisma)

```ts
import { UTCDate } from '@date-fns/utc'
import { startOfMonth } from 'date-fns'

export const TIME_ZONE = 'America/Sao_Paulo'
export const day = (date: Date) => date.toISOString().slice(0, 10)
export const monthKey = (date: Date) => date.toISOString().slice(0, 7)
export const monthStart = (date: Date) => startOfMonth(new UTCDate(date))
export function localClock(now: Date) { /* mova o corpo atual de email/jobs.tsx sem mudar */ }
```
Depois: em `debts/match.ts` apague as 3 definições e faça `export { day, monthKey, monthStart } from '@/lib/dates'`
(mantém quem importa de `match.ts` funcionando). Em `recurring.ts`, `jobs.tsx` e
`summary/route.ts`, apague as cópias locais e importe de `@/lib/dates` (`jobs.tsx` também
importa `TIME_ZONE` e `localClock`; mantenha `export { localClock }` em `jobs.tsx` se algum
arquivo importar `localClock` de lá — confira com `grep -rn "localClock" src`).

**Verificar**: `bun run typecheck` → exit 0;
`grep -rn "toISOString().slice(0, 7)" src/lib src/app/api` → só `src/lib/dates.ts`.

### Passo 2: `src/lib/totals.ts`

```ts
/** Transação com alguma tag "fora dos totais" (transferência entre contas próprias) */
export function isExcludedFromTotals(tags: { tag: { excludeFromTotals: boolean } }[]) {
	return tags.some(({ tag }) => tag.excludeFromTotals)
}
```
Troque as duas reescritas em JS (`summary/route.ts`, `email/reports.ts`) por essa função, e o
filtro inline de `reports.ts:~96` por `...COUNTS_IN_TOTALS` (import de `@/lib/tags`).

**Verificar**: `bun run typecheck` → exit 0; `grep -rn "tag.excludeFromTotals)" src/lib src/app/api` → só `src/lib/totals.ts`.

### Passo 3: Testes dos helpers

`src/lib/dates.test.ts`: `day(new Date('2026-03-05T00:00:00Z'))` → `'2026-03-05'`;
`monthKey` → `'2026-03'`; `monthStart(new Date('2026-03-31T23:00:00Z'))` → `2026-03-01T00:00:00.000Z`;
`localClock(new Date('2026-03-01T02:00:00Z'))` → `today` = `2026-02-28T00:00:00.000Z`, `hour` = `23`
(23h em São Paulo, UTC−3).
`src/lib/totals.test.ts`: lista vazia → false; uma tag excluída → true; só tags normais → false.

**Verificar**: `bun test src/lib/dates.test.ts src/lib/totals.test.ts` → todos passam.

### Passo 4: Checagem de sessão em um lugar

Crie `src/lib/api-session.ts`:
```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/** Sessão da requisição, ou a resposta 401 pronta para devolver */
export async function requireSession(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return { session: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const
	}
	return { session, response: null } as const
}
```
Em cada handler dos 27 arquivos, troque o bloco por:
```ts
const { session, response } = await requireSession(request)
if (!session) return response
```
Faça arquivo por arquivo; remova o import de `auth` quando ficar sem uso. Não mude mais nada.

**Verificar**: `bun run typecheck` → exit 0;
`grep -rn "auth.api.getSession" src/app/api` → nenhuma linha (exceto se alguma rota usar a
sessão de outro jeito — nesse caso PARE e reporte qual).

### Passo 5: Portão final

**Verificar**: `bun run check` → exit 0.

## Plano de testes

`dates.test.ts` (4 casos) e `totals.test.ts` (3 casos), no padrão de `src/lib/format.test.ts`.

## Critérios de pronto

- [ ] `bun run check` sai 0
- [ ] `grep -rn "toISOString().slice(0, 7)" src/lib src/app/api` só em `src/lib/dates.ts`
- [ ] `grep -rn "auth.api.getSession" src/app/api` vazio
- [ ] Nenhum arquivo de `src/app/(pages)` alterado (`git status --short "src/app/(pages)"` sem mudanças suas)
- [ ] Linha do plano 003 em `plans/README.md` atualizada

## Condições de PARADA

- Alguma rota usa `session` de forma diferente (ex.: sessão opcional) — não force o padrão.
- Mover `localClock` muda a saída de algum teste existente.
- Typecheck falha por import circular (`dates.ts` não pode importar nada de `@/lib/debts` ou `@/lib/email`).

## Notas de manutenção

- O plano 007 vai acrescentar `localToday()`/mês atual em `src/lib/dates.ts` e trocar os
  `new Date()` do servidor — por isso este plano vem antes.
- Revisor: confira que cada rota continua devolvendo 401 com o mesmo JSON.
