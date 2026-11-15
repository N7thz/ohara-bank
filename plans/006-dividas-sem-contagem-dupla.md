# Plano 006: Cada pagamento conta para uma única dívida e só dentro do período dela

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- src/lib/debts src/app/api/finance/debts/schema.ts`
> Confira os trechos de "Estado atual" direto nos arquivos (havia mudanças não commitadas).

## Status

- **Prioridade**: P1
- **Esforço**: M
- **Risco**: MED (números da página de Dívidas mudam; é a intenção, mas o dono vai notar)
- **Depende de**: plans/001-verificacao-base.md, plans/003-helpers-comuns.md (opcional; não bloqueia)
- **Categoria**: bug
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

A página de Dívidas (e os e-mails de contas) acham os pagamentos de cada dívida procurando um
trecho da descrição (`pattern`, ex.: `"telefonica|vivo-rj"`) nas saídas. Hoje:
1. Uma mesma transação pode casar com duas dívidas (ex.: padrões `vivo` e `telefonica|vivo-rj`)
   e é contada nas duas — no "pago" do gráfico e nas parcelas.
2. Pagamentos DEPOIS do fim de uma parcelada (compra nova na mesma loja) continuam somando no
   "pago" do gráfico e em `paidTotal`/`lastPayment`/`paymentCount`.
3. A validação aceita padrões como `luz|a` (o mínimo de 3 letras vale para o texto inteiro, não
   para cada parte); a parte `a` casa quase todas as saídas.
Resultado: totais "pagos" inflados, parcelas marcadas como pagas antes da hora.

## Estado atual

- `src/lib/debts/match.ts`:
  ```ts
  // ~linha 15
  export function splitPattern(pattern: string) {
  	return pattern.split('|').map(normalizeText).filter(Boolean)
  }
  // ~linha 44
  export function matchPayments(debt: { startMonth: Date; pattern: string }, expenses: Expense[]) {
  	const start = monthStart(debt.startMonth)
  	const patterns = splitPattern(debt.pattern)
  	const matched = expenses.filter(
  		(tx) => tx.date >= start && patterns.some((pattern) => tx.text.includes(pattern)),
  	)
  	const paidMonths = [...new Set(matched.map((tx) => monthKey(tx.date)))]
  	return { matched, paidMonths }
  }
  ```
  `Expense` = `{ id, date, accountId, amount (positivo), description, text (normalizado) }`
  (vem de `loadExpenses`). `endMonthOf(debt, paidMonths, current)` devolve o último mês de uma
  parcelada (ou `null` para fixas/recorrentes).
- `src/lib/debts/overview.ts:~92-112` (dentro de `debts.map`):
  ```ts
  const { matched, paidMonths } = matchPayments(debt, normalized)
  const end = endMonthOf(debt, paidMonths, current)
  const payments: Payment[] = matched.map(({ date, amount, description }) => ({ date, amount, description }))
  ...
  const paidByMonth = new Map<string, Money>()
  for (const payment of payments) { /* soma por monthKey */ }
  const paidTotal = sumMoney(payments.map((payment) => toMoney(payment.amount)))
  ```
  e no gráfico (`~linha 214-223`) o "pago" do mês soma `item._paidByMonth.get(key)` SEM checar
  `isActiveIn(month, item._start, item._end)` (o "previsto" checa).
- Outros chamadores de `matchPayments`: `src/lib/debts/installments.ts:~29` (rótulo "parcela X
  de Y" na lista de transações) e `src/app/api/finance/debts/preview/route.ts:~24` (prévia de um
  padrão no formulário — aqui casar com várias dívidas é OK, é só prévia).
- `src/app/api/finance/debts/schema.ts:14`: `pattern: z.string().trim().min(3).max(120),`

## Comandos que você vai usar

| Propósito | Comando | Esperado |
|---|---|---|
| Testes | `bun test src/lib/debts` | todos passam |
| Tudo | `bun run check` | exit 0 |

## Escopo

**Dentro do escopo**: `src/lib/debts/match.ts`, `src/lib/debts/overview.ts`,
`src/lib/debts/installments.ts`, `src/app/api/finance/debts/schema.ts`,
`src/lib/debts/match.test.ts` (criar).

**Fora do escopo**: `debts/preview/route.ts` (prévia continua mostrando tudo que casa),
`src/app/api/finance/recurring/route.ts` (tem a própria lógica; não mexa), UI, schema do Prisma.

## Fluxo de git

Não commite, não faça stash nem checkout. Se instruído: `fix: ...` em pt-BR, só estes arquivos.

## Passos

### Passo 1: Partes do padrão com 3+ caracteres

- `splitPattern`: acrescente `.filter((part) => part.length >= 3)` depois do `filter(Boolean)`.
- `schema.ts`: troque a linha do `pattern` por
  ```ts
  pattern: z.string().trim().min(3).max(120).refine(
  	(value) => value.split('|').every((part) => part.trim().length >= 3),
  	{ message: 'Cada trecho separado por | precisa de pelo menos 3 letras' },
  ),
  ```

**Verificar**: `bun run typecheck` → exit 0.

### Passo 2: Atribuir cada transação a uma só dívida

Em `match.ts`, crie e exporte:
```ts
/**
 * Transação que casa com mais de uma dívida fica com a do trecho mais longo (mais específico);
 * empate: a primeira da lista. Devolve, por id de dívida, os ids de transação que são dela
 */
export function assignPayments(
	debts: { id: string; startMonth: Date; pattern: string }[],
	expenses: Expense[],
): Map<string, Set<string>>
```
Implementação: para cada transação, entre as dívidas cujo `startMonth` ≤ data e que têm alguma
parte contida em `tx.text`, escolha a de maior comprimento da parte casada; acumule no mapa.

Em `overview.ts`, antes de `debts.map`, calcule `const owned = assignPayments(debts, normalized)`;
dentro do map, depois de `matchPayments`, filtre:
`const mine = matched.filter((tx) => owned.get(debt.id)?.has(tx.id))` e recalcule `paidMonths`
a partir de `mine` (mesma fórmula de `matchPayments`). Use `mine` no lugar de `matched` dali em
diante. Faça o mesmo em `installments.ts` se ele recebe a lista de dívidas inteira (confira; se
recebe uma dívida por vez sem a lista, PARE e reporte).

**Verificar**: `bun run typecheck` → exit 0.

### Passo 3: Só contar pagamentos até o fim da dívida

Em `overview.ts`, depois de calcular `end`, descarte pagamentos de meses depois de `end`:
`const inRange = end ? mine.filter((tx) => monthStart(tx.date) <= end) : mine` e use `inRange`
para `payments`, `paidByMonth`, `paidTotal`, `lastPayment`, `paymentCount`. No laço do gráfico,
some `paidInMonth` só quando `isActiveIn(month, item._start, item._end)` for verdadeiro (mantenha
o tratamento do override `'PAID'`).

**Verificar**: `bun run typecheck` → exit 0.

### Passo 4: Testes

`src/lib/debts/match.test.ts` (funções puras; monte `Expense` à mão com `text` já minúsculo):
- `splitPattern('luz|a')` → `['luz']`.
- `assignPayments` com dívidas `{id:'a', pattern:'vivo'}` e `{id:'b', pattern:'telefonica|vivo-rj'}`
  e uma transação `text: 'pagamento vivo-rj'` → fica só em `b`.
- Empate de comprimento → fica na primeira.
- Transação antes do `startMonth` → não é atribuída.
Se `match.ts` importar o Prisma e o teste exigir `DATABASE_URL`, rode com
`DATABASE_URL=postgres://x bun test src/lib/debts` (o cliente não conecta enquanto não houver
consulta); se ainda falhar, PARE.

**Verificar**: `bun test src/lib/debts` → todos passam; `bun run check` → exit 0.

## Critérios de pronto

- [ ] `bun run check` sai 0
- [ ] `match.test.ts` com os 4 casos passando
- [ ] `schema.ts` rejeita `'luz|a'` (teste rápido: `debtInputSchema.safeParse({...válido, pattern: 'luz|a'}).success === false` — acrescente ao teste)
- [ ] Linha do plano 006 em `plans/README.md` atualizada

## Condições de PARADA

- Alguma dívida do dono depende de uma parte com menos de 3 letras (não há como saber pelo
  código; se a tela de Dívidas perder pagamentos após o passo 1, reporte em vez de reverter).
- `installments.ts` não tem acesso à lista de dívidas para usar `assignPayments`.
- Os testes exigirem banco de dados.

## Notas de manutenção

- A regra "trecho mais longo ganha" precisa estar documentada na tela de ajuda do formulário
  se o dono reclamar de pagamento "sumindo" de uma dívida.
- `recurring/route.ts` ainda casa padrões por conta própria (pode contar a mesma transação em
  duas contas recorrentes) — deixado de fora deliberadamente; candidato a seguir o mesmo padrão.
