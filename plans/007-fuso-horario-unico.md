# Plano 007: "Hoje" e "mês atual" sempre no horário de Brasília, no servidor e na tela

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- src/lib/dates.ts src/lib/debts/overview.ts src/lib/email/jobs.tsx src/app/api/finance "src/app/(pages)/dashboard"`
> Confira os trechos de "Estado atual" direto nos arquivos (havia mudanças não commitadas).

## Status

- **Prioridade**: P2
- **Esforço**: M
- **Risco**: LOW
- **Depende de**: plans/003-helpers-comuns.md (cria `src/lib/dates.ts` com `TIME_ZONE`, `localClock`, `monthStart`, `monthKey`, `day`)
- **Categoria**: bug
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

As transações são gravadas à meia-noite UTC de cada dia. O app usa às vezes o dia/mês em UTC
(`new Date()` + `toISOString`/`monthStart`) e às vezes o de São Paulo (UTC−3). Entre 21h e
23h59 (horário de Brasília) o "hoje" em UTC já é amanhã: no último dia do mês, marcar uma
conta como PAGA grava no mês SEGUINTE e o mês atual continua "atrasado"; o formulário de nova
dívida sugere o mês seguinte; o corte do gráfico de ritmo de gastos anda um dia. O dono mora
no Brasil; a regra correta é sempre o dia de São Paulo, expresso à meia-noite UTC (como as
transações).

## Estado atual

- Depois do plano 003, `src/lib/dates.ts` tem `TIME_ZONE = 'America/Sao_Paulo'`,
  `day`, `monthKey`, `monthStart` e `localClock(now: Date)` → `{ today: UTCDate (meia-noite UTC
  do dia em São Paulo), hour }`. `dates.ts` não importa Prisma, então pode ser usado no cliente.
- Servidor usando UTC:
  - `src/lib/debts/overview.ts:74`: `const current = monthStart(new Date())` (dentro de
    `getDebtsOverview(userId)`)
  - `src/app/api/finance/debts/[id]/status/route.ts:37`: `const month = monthStart(new Date())`
  - `src/app/api/finance/summary/route.ts:73`: `const current = fns.start(new Date())`
  - `src/app/api/finance/recurring/route.ts:18`: `const today = new Date()`
  - `src/lib/email/jobs.tsx:73-74`: `billsEmail(userId, today, …)` chama
    `getDebtsOverview(userId)` (UTC) mas usa `monthKey(today)` (São Paulo) logo abaixo.
- Cliente usando UTC:
  - `src/app/(pages)/dashboard/finance/debts/_components/debts-view.tsx:62`:
    `const currentMonth = () => new Date().toISOString().slice(0, 7)`
  - `src/app/(pages)/dashboard/(summary)/_components/spending-pace-chart.tsx:88`:
    `const today = new Date().toISOString().slice(0, 10)`
  - `src/app/(pages)/dashboard/finance/recurring/_components/recurring-view.tsx:77`:
    `const today = new Date().toISOString().slice(0, 10)`
  - `src/app/(pages)/dashboard/finance/debts/_components/payoff-chart.tsx:88`:
    `const nowMonth = monthIndex(new Date().toISOString().slice(0, 7))`
- Cliente já usando o dia local do navegador (correto para quem está no Brasil; padronize
  mesmo assim): `(summary)/_components/budget-progress.tsx:22`
  (`format(new Date(), 'yyyy-MM-dd')`) e `transactions/_components/spending-heatmap.tsx:42-43`.
- NÃO mexer (não são "hoje" de calendário): `src/lib/auth/totp-sign-in.ts:52`,
  `src/lib/auth/totp-status.ts:16` (bloqueio por tempo), `src/lib/email/jobs.tsx:278` (janela de
  120 dias), `transactions-view.tsx:53` (só formata nome do mês).

## Comandos que você vai usar

| Propósito | Comando | Esperado |
|---|---|---|
| Testes | `bun test src/lib/dates.test.ts` | todos passam |
| Tudo | `bun run check` | exit 0 |

## Escopo

**Dentro do escopo**: `src/lib/dates.ts`, `src/lib/dates.test.ts`, `src/lib/debts/overview.ts`,
`src/lib/email/jobs.tsx`, `src/app/api/finance/debts/[id]/status/route.ts`,
`src/app/api/finance/summary/route.ts`, `src/app/api/finance/recurring/route.ts`, e os 6 arquivos
do cliente listados acima.

**Fora do escopo**: as linhas listadas em "NÃO mexer"; dados já gravados (overrides de mês
salvos no mês errado ficam como estão); o fuso das datas das transações.

## Fluxo de git

Não commite, não faça stash nem checkout. Se instruído: `fix: ...` em pt-BR, só estes arquivos.

## Passos

### Passo 1: Helpers de "hoje" em `src/lib/dates.ts`

```ts
/** Hoje em São Paulo, à meia-noite UTC (o mesmo formato das datas das transações) */
export const localToday = (now = new Date()) => localClock(now).today
/** Primeiro dia do mês atual em São Paulo, à meia-noite UTC */
export const localMonthStart = (now = new Date()) => monthStart(localToday(now))
/** "AAAA-MM-DD" de hoje em São Paulo */
export const localTodayKey = (now = new Date()) => day(localToday(now))
/** "AAAA-MM" do mês atual em São Paulo */
export const localMonthKey = (now = new Date()) => monthKey(localToday(now))
```
Testes em `dates.test.ts`: com `now = new Date('2026-03-01T01:30:00Z')` (22h30 de 28/02 em SP):
`localTodayKey(now)` → `'2026-02-28'`, `localMonthKey(now)` → `'2026-02'`,
`localMonthStart(now).toISOString()` → `'2026-02-01T00:00:00.000Z'`; com
`new Date('2026-03-01T03:30:00Z')` → `'2026-03-01'`.

**Verificar**: `bun test src/lib/dates.test.ts` → todos passam.

### Passo 2: Servidor

- `overview.ts`: `getDebtsOverview(userId: string, today = localToday())` e
  `const current = monthStart(today)`.
- `jobs.tsx` (`billsEmail`): `getDebtsOverview(userId, today)`.
- `debts/[id]/status/route.ts`: `const month = localMonthStart()`.
- `summary/route.ts`: `const current = fns.start(localToday())`.
- `recurring/route.ts`: `const today = localToday()`.

**Verificar**: `bun run typecheck` → exit 0;
`grep -n "new Date()" src/lib/debts/overview.ts "src/app/api/finance/debts/[id]/status/route.ts" src/app/api/finance/summary/route.ts src/app/api/finance/recurring/route.ts` → nenhuma linha.

### Passo 3: Cliente

Troque as expressões listadas em "Estado atual" por `localMonthKey()` / `localTodayKey()`
importados de `@/lib/dates` (em `budget-progress.tsx` e `spending-heatmap.tsx`, troque o cálculo
do dia de hoje por `localTodayKey()`/`localToday()` mantendo o tipo que o código espera — em
`spending-heatmap.tsx`, `today` é um número `Date.UTC(...)`: use `localToday().getTime()`).

**Verificar**: `bun run typecheck` → exit 0;
`grep -rn "new Date().toISOString().slice" "src/app/(pages)"` → nenhuma linha.

### Passo 4: Portão final

**Verificar**: `bun run check` → exit 0.

## Critérios de pronto

- [ ] `bun run check` sai 0
- [ ] Testes de `localTodayKey`/`localMonthKey` nas bordas (22h30 e 00h30 em SP) passando
- [ ] Greps dos passos 2 e 3 vazios
- [ ] Linha do plano 007 em `plans/README.md` atualizada

## Condições de PARADA

- O plano 003 não foi executado (`src/lib/dates.ts` não existe ou não tem `localClock`).
- `getDebtsOverview` é chamado em lugares além de `/api/finance/debts` e `jobs.tsx` com uma
  assinatura que o parâmetro novo quebraria.
- Importar `@/lib/dates` num componente cliente puxa algo de servidor (erro de build "server-only").

## Notas de manutenção

- Regra para código novo: nunca `new Date().toISOString().slice(...)` para "hoje"; use os
  helpers `local*` de `src/lib/dates.ts`.
- Overrides de status salvos no mês errado antes desta correção não são migrados.
