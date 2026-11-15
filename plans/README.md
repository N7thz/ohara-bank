# Planos de implementação

Gerados pela skill `improve` em 2026-11-14, a partir do commit `84bba39` mais a árvore de
trabalho não commitada daquele momento. Execute na ordem abaixo, a menos que as dependências
digam outra coisa. Cada executor: leia o plano inteiro antes de começar, respeite as
"Condições de PARADA" e atualize a sua linha ao terminar.

Regras que valem para todos os planos:
- Não commitar, não fazer stash nem checkout sem instrução do dono (há trabalho não commitado
  de outras tarefas).
- Nunca abrir `.env` nem a pasta `extratos/` (dados reais); fixtures de teste são inventadas.
- Nunca rodar `biome --write`/`format --write` sobre `src/components/ui/` (gerado pelo shadcn).
- O schema do Prisma fica dividido por domínio em `prisma/schema/*.prisma`.
- Portão de verificação: `bun run check` (criado no plano 001).

## Ordem de execução e status

| Plano | Título | Prioridade | Esforço | Depende de | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Comando único de verificação (`bun run check`) | P1 | S | — | DONE |
| 002 | Testes dos leitores de extrato e do dinheiro | P1 | M | 001 | DONE |
| 003 | Helpers comuns: datas, "fora dos totais", sessão | P2 | M | 001, 002 | DONE |
| 004 | CSV exportado sem fórmulas | P1 | S | 001 | DONE |
| 005 | Corrigir leitores de extrato (sinal, OFX, valores BR) | P1 | S | 002 | DONE |
| 006 | Dívidas sem contagem dupla | P1 | M | 001 | DONE |
| 007 | "Hoje" sempre no horário de Brasília | P2 | M | 003 | DONE |
| 008 | Endurecer o login por código (TOTP) | P2 (P1 se publicado) | M | 001 | DONE |
| 009 | Limites do upload e PDF lido uma vez | P2 | S | 001 | DONE |
| 010 | E-mails sem duplicar e resumos com todas as contas | P2 | M | 001 | DONE |
| 011 | Holerite de 13º/férias guardado | P3 | M | 001 (009 ajuda) | DONE |
| 012 | `.env.example` e README | P2 | S | — | DONE |
| 013 | Desempenho da lista de Transações | P3 | M | 001 (003 ajuda) | DONE |

Valores de status: TODO | IN PROGRESS | DONE | BLOCKED (com motivo de uma linha) | REJECTED (com justificativa de uma linha)

## Notas de dependência

- **001 antes de tudo**: cria `bun run check`, o portão de todos os outros.
- **002 antes de 005**: o 002 trava o comportamento atual dos leitores (inclusive os bugs, com
  comentário `BUG conhecido — muda no plano 005`); o 005 corrige e inverte esses testes.
- **002 antes de 003**: o 002 move `normalizeText` para `src/lib/text.ts`; o 003 cria
  `src/lib/dates.ts` no mesmo espírito (módulos puros, sem Prisma).
- **003 antes de 007**: o 007 acrescenta `localToday()` etc. em `src/lib/dates.ts`.
- **009 e 011** mexem em `src/lib/payslips/index.ts`: se o 009 rodar antes, o 011 aplica as
  mudanças em `parsePayslipRows`.
- **008, 010, 011** criam migrações Prisma — rode um de cada vez (não em paralelo).
- **013** mexe em `transactions-view.tsx`, arquivo que outras sessões editam com frequência —
  confira reservas antes.

## Achados considerados e rejeitados (para não reauditar)

- **Dependência `cn` sem uso**: falso — é importada em `src/components/ui/chart.tsx` e
  `empty.tsx` (gerados pelo shadcn). O ponto real (importar `cn` de um pacote externo em vez de
  `@/lib/utils`) é cosmético.
- **Pagamento de fatura contado em dobro**: resolvido no Itaú (regra "fatura paga itau" na tag
  "Transferências próprias" desde a importação das faturas do cartão); no Nubank não se aplica
  (o cartão do Nubank não é importado).
- **N+1 no job de e-mails**: o app tem um usuário só; não vale o esforço.
- **Seed imprime o segredo TOTP**: é o fluxo de instalação proposital de um app local.
- **IDOR / atribuição em massa**: auditado e limpo — toda rota `[id]` confere o dono e todo
  `create/update` usa objeto validado por zod.
- **Índices do banco**: datas, conta e tags estão cobertos; só a busca por texto não tem índice
  (ver nota no plano 013).

## Achados de prioridade baixa não planejados

Cabeçalhos de segurança HTTP (CSP, frame-ancestors) — só importam se publicado; mensagens de
erro cruas de bibliotecas devolvidas ao cliente; limite de frequência no e-mail de teste;
checar se as migrações batem com o schema (`prisma migrate diff`); fixar `better-auth` na mesma
versão exata de `@better-auth/passkey`; mover o CLI `shadcn` para `devDependencies`.
