# Plano 013: Trocar de página na lista de Transações não recalcula o histórico inteiro

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- src/app/api/finance/transactions src/hooks/finance/transactions.ts src/hooks/finance/keys.ts "src/app/(pages)/dashboard/finance/transactions/_components/transactions-view.tsx"`
> Esses arquivos mudam com frequência (outras sessões trabalham neles). Confira os trechos de
> "Estado atual" direto nos arquivos; se não baterem, PARE.

## Status

- **Prioridade**: P3
- **Esforço**: M
- **Risco**: MED (a tela mais usada; os números têm de continuar idênticos)
- **Depende de**: plans/001-verificacao-base.md; idealmente depois do 003 (`requireSession`)
- **Categoria**: perf
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

Cada requisição de `GET /api/finance/transactions` (trocar de página, digitar na busca, mudar
um filtro) dispara 11 consultas em paralelo. Duas delas carregam para a memória TODAS as
transações do escopo (todas as ligações tag-transação e o histórico de todos os meses), que o
código depois soma em JavaScript, e ainda roda `getInstallmentLabels`, que carrega todas as
saídas desde a primeira dívida parcelada. O gráfico por mês, os gastos por tag, a lista de meses
e as contagens por tag NÃO dependem da página — mas são recalculados a cada clique em "próxima
página". O custo cresce a cada extrato importado. A solução de menor risco é separar o que não
depende da página numa segunda rota com chave de cache própria: trocar de página passa a
consultar só a página.

## Estado atual

- `src/app/api/finance/transactions/route.ts` (172 linhas). Usa
  `transactionWhere(userId, query.data)` de `src/lib/transaction-filters.ts`, que devolve
  `{ allMonths, scope, tagFilter, base, where }`. O `Promise.all` (~linhas 34-97) busca:
  - DEPENDEM da página/filtros completos: `transactions` (findMany com `skip/take`), `total`
    (count), `income`/`expense` (aggregate com `base`), `excluded` (aggregate), `installments`
    (`getInstallmentLabels(userId)`).
  - NÃO dependem da página: `months` (`$queryRaw` com `DISTINCT to_char(t.date,'YYYY-MM')`, só
    por usuário/conta), `tagLinks` (findMany de `transactionTag` com `scope` + `COUNTS_IN_TOTALS`
    → somado em JS em `byTag`), `untagged` (aggregate com `scope`), `history` (findMany com
    `allMonths`, `tagFilter`, `COUNTS_IN_TOTALS` → somado em JS em `byMonth`), `tagCounts`
    (groupBy de `transactionTag` por `tagId` com `scope`).
  - Resposta: `{ transactions, total, page, pageSize, summary: { income, expense, excludedCount },
    months, byTag, untagged, byMonth, tagCounts }`.
- `src/hooks/finance/transactions.ts`: `interface TransactionPage` (com `byMonth`, `byTag` etc.),
  `transactionsQuery(filters)` com `queryKey: financeKeys.transactions(filters)` e
  `useTransactions(filters)` com `placeholderData: keepPreviousData`.
- `src/hooks/finance/keys.ts:11`: `transactions: (filters: object) => ['finance', 'transactions', filters] as const`.
  Todas as mutações de finanças invalidam a raiz `['finance']` — uma chave nova sob `'finance'`
  é invalidada automaticamente.
- `src/app/(pages)/dashboard/finance/transactions/_components/transactions-view.tsx` usa
  `data.months` (~linha 183), `data.tagCounts` (~187), `data.byMonth` (~399-402),
  `data.byTag`/`data.untagged` (~412-416), e da página `data.total`, `data.summary`,
  `data.transactions`.
- Convenção de hooks: um `xxxQuery(filters)` com `queryKey` de `financeKeys` + `useXxx` (veja
  `transactionsQuery`/`useTransactions`).

## Comandos que você vai usar

| Propósito | Comando | Esperado |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Tudo | `bun run check` | exit 0 |

## Escopo

**Dentro do escopo**: `src/app/api/finance/transactions/route.ts`,
`src/app/api/finance/transactions/overview/route.ts` (criar), `src/hooks/finance/transactions.ts`,
`src/hooks/finance/keys.ts`, `transactions-view.tsx` (só trocar de onde vêm os campos).

**Fora do escopo**: mudar QUALQUER cálculo (as somas devem dar exatamente o mesmo resultado),
`getInstallmentLabels` (otimizar a numeração das parcelas fica para outro plano), o visual da
tela, outras rotas.

## Fluxo de git

Não commite, não faça stash nem checkout. Se instruído: `perf: ...` em pt-BR, só estes arquivos.

## Passos

### Passo 1: Rota nova com o que não depende da página

Crie `src/app/api/finance/transactions/overview/route.ts` com o mesmo `querySchema` de filtros
(sem `page`/`pageSize`; use `transactionFiltersSchema` de `@/lib/transaction-filters`), a mesma
checagem de sessão da rota atual, e MOVA (copie exatamente, sem mudar) as consultas `months`,
`tagLinks`, `untagged`, `history`, `tagCounts` e o código que monta `byTag` e `byMonth`.
Resposta: `{ months, byTag, untagged, byMonth, tagCounts }` com os mesmos formatos.

**Verificar**: `bun run typecheck` → exit 0.

### Passo 2: Enxugar a rota da página

Na rota original, remova essas 5 consultas e os campos correspondentes da resposta. Ela passa
a devolver `{ transactions, total, page, pageSize, summary }`.

**Verificar**: `bun run typecheck` → vai acusar os usos no cliente (passo 3); nenhum erro no servidor.

### Passo 3: Hook e chave novos; a tela usa os dois

- `keys.ts`: `transactionsOverview: (filters: object) => ['finance', 'transactions-overview', filters] as const`.
- `transactions.ts`: mova `months`, `byTag`, `untagged`, `byMonth`, `tagCounts` de
  `TransactionPage` para `interface TransactionsOverview`; crie `transactionsOverviewQuery(filters)`
  (chamando `/finance/transactions/overview` com os filtros SEM `page`) e
  `useTransactionsOverview(filters)` com `placeholderData: keepPreviousData`. A chave não inclui
  `page` — é isso que faz trocar de página não refazer o resumo.
- `transactions-view.tsx`: `const { data: overview } = useTransactionsOverview(filtrosSemPagina)`
  e troque `data.months` → `overview?.months`, `data.tagCounts` → `overview?.tagCounts`,
  `data.byMonth`/`data.byTag`/`data.untagged` → `overview?.…`, mantendo os mesmos fallbacks
  (`?? []`, `?? {}`) e a mesma renderização condicional. Não mude mais nada na tela.

**Verificar**: `bun run typecheck` → exit 0; `bun run check` → exit 0.

### Passo 4: Conferência de números (manual, o dono faz)

Descreva na mensagem de conclusão: abrir Transações antes/depois com os mesmos filtros e
comparar o gráfico por mês, os gastos por tag, a lista de meses e as contagens das tags — devem
ser idênticos; trocar de página não deve mais disparar a requisição `/overview` (aba Rede do
navegador).

## Critérios de pronto

- [ ] `bun run check` sai 0
- [ ] `grep -n "history\|tagLinks" src/app/api/finance/transactions/route.ts` → nenhuma linha
- [ ] A chave `transactionsOverview` não contém `page`
- [ ] Linha do plano 013 em `plans/README.md` atualizada

## Condições de PARADA

- Outra tela além de `transactions-view.tsx` usa `byMonth`/`byTag`/`months`/`tagCounts` da
  resposta de `/finance/transactions` (confira com `grep -rn "byMonth\|tagCounts" src`).
- A tela estiver no meio de outra refatoração (outra sessão reservou o arquivo) — combine antes.
- Qualquer número precisar mudar para o código compilar.

## Notas de manutenção

- Próximo passo, se ainda estiver lento: mover as somas de `byMonth`/`byTag` para SQL
  (`date_trunc('month')` + `SUM`) e numerar parcelas só das transações da página.
- Busca por texto (`description contains`, insensível a maiúsculas) não tem índice; avalie um
  índice `pg_trgm` só se `EXPLAIN` mostrar lentidão real.
