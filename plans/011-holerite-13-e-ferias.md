# Plano 011: Holerite de 13º, férias ou complementar do mesmo mês é guardado, não descartado

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- prisma/schema/payslips.prisma src/lib/payslips "src/app/(pages)/dashboard/finance/_components/payslip-list.tsx"`
> Confira os trechos de "Estado atual" direto nos arquivos (havia mudanças não commitadas).

## Status

- **Prioridade**: P3
- **Esforço**: M
- **Risco**: MED (muda a chave única de uma tabela com dados reais)
- **Depende de**: plans/001-verificacao-base.md; se o plano 009 já rodou, `parsePayslip` estará
  dividido em `parsePayslipRows` — aplique as mudanças de leitura nessa função.
- **Categoria**: bug
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

A tabela de holerites só permite UM holerite por empregador e mês de competência. Quando chega
um segundo documento do mesmo mês — 13º salário, férias, adiantamento ou complementar — a
importação devolve "já tinha sido importado" e o descarta, e a renda do mês fica subestimada.
Além disso, a competência `13/AAAA` (usada por algumas folhas para o 13º) não é reconhecida e a
importação falha. E a checagem "existe? então cria" não é atômica: dois envios simultâneos
geram um erro 500 (violação de unicidade P2002).

## Estado atual

- `prisma/schema/payslips.prisma` — modelo `Payslip`: `employerName`, `employerCnpj`,
  `competence DateTime` (dia 1 do mês, UTC), `grossAmount`, `deductionsAmount`, `netAmount`
  (`Decimal(14,2)`), `fgtsAmount?`, `items PayslipItem[]`, e
  `@@unique([userId, employerCnpj, competence])`. Regra do dono: o schema fica dividido por
  domínio em `prisma/schema/`; edite este arquivo.
- `src/lib/payslips/index.ts:~143-150` (competência):
  ```ts
  // Competência MM/AAAA (a data de admissão é DD/MM/AAAA e fica de fora)
  const competenceMatch = rows.flat().map((item) => item.text.match(/^(0[1-9]|1[0-2])\/(\d{4})$/)).find(Boolean)
  if (!competenceMatch) throw new Error('Competência não encontrada no holerite')
  const competence = new Date(Date.UTC(Number(competenceMatch[2]), Number(competenceMatch[1]) - 1, 1))
  ```
  O título do documento fica na primeira página (ex.: "RECIBO DE PAGAMENTO DE SALÁRIO"); um
  recibo de férias costuma dizer "FÉRIAS" no título.
- `src/lib/payslips/save.ts` (inteiro):
  ```ts
  export async function savePayslip(userId: string, payslip: ParsedPayslip) {
  	const { items, ...data } = payslip
  	const existing = await prisma.payslip.findUnique({ where: { userId_employerCnpj_competence: { userId, employerCnpj: data.employerCnpj, competence: data.competence } } })
  	if (existing) return { payslip: existing, created: false }
  	const created = await prisma.payslip.create({ data: { ...data, userId, items: { create: items } } })
  	return { payslip: created, created: true }
  }
  ```
- Tela: `src/app/(pages)/dashboard/finance/_components/payslip-list.tsx` mostra
  `{formatCompetence(payslip.competence)} · {payslip.employerName}` (linha ~70).
- Migrações: `bun run db:migrate --name <nome>`.

## Comandos que você vai usar

| Propósito | Comando | Esperado |
|---|---|---|
| Migração | `bun run db:migrate --name payslip_kind` | criada e aplicada |
| Cliente Prisma | `bun run db:generate` | exit 0 |
| Tudo | `bun run check` | exit 0 |

## Escopo

**Dentro do escopo**: `prisma/schema/payslips.prisma` + migração nova, `src/lib/payslips/index.ts`,
`src/lib/payslips/save.ts`, `payslip-list.tsx` (só o rótulo), `src/app/api/finance/payslips/route.ts`
(só se precisar devolver o campo novo), e o tipo do hook em `src/hooks/finance/*` que descreve
`Payslip` (confira com `grep -rn "employerCnpj" src/hooks`).

**Fora do escopo**: interpretação das verbas (`parseItems`), gráficos de holerite, dados existentes
(todos ficam como `MONTHLY`).

## Fluxo de git

Não commite, não faça stash nem checkout. Se instruído: `fix: ...` em pt-BR, só estes arquivos.

## Passos

### Passo 1: Tipo do holerite e nova chave única

Em `payslips.prisma`:
```prisma
enum PayslipKind {
  MONTHLY
  THIRTEENTH
  VACATION
}
// no modelo Payslip:
kind PayslipKind @default(MONTHLY)
// troque @@unique([userId, employerCnpj, competence]) por:
@@unique([userId, employerCnpj, competence, kind, netAmount])
```
(O líquido entra na chave para que um holerite complementar do mesmo tipo e mês, com outro
valor, também seja guardado; reimportar o MESMO PDF continua sendo reconhecido como repetido.)
Rode `bun run db:migrate --name payslip_kind` e `bun run db:generate`. Confira no SQL gerado
que a coluna nova tem `DEFAULT 'MONTHLY'` (as linhas existentes ficam válidas).

**Verificar**: `bun run typecheck` → vai FALHAR em `save.ts` (o nome da chave composta mudou);
isso é esperado e é resolvido no passo 3. Qualquer outro erro: PARE.

### Passo 2: Reconhecer o tipo e a competência 13

Em `index.ts`:
- Competência: aceite também `13/AAAA` → regex `/^(0[1-9]|1[0-3])\/(\d{4})$/`; se o mês for `13`,
  `competence = dezembro do ano` e `kind = 'THIRTEENTH'`.
- Se o texto da primeira página (já existe `text`) casar `/f[ée]rias/i` → `kind = 'VACATION'`;
  senão, se casar `/13[ºo°]?\s*sal[áa]rio|d[ée]cimo terceiro/i` → `'THIRTEENTH'`; senão `'MONTHLY'`.
- Inclua `kind` em `ParsedPayslip` e no objeto devolvido.

### Passo 3: Gravação atômica

Em `save.ts`, use a chave nova e trate a corrida:
```ts
const where = { userId_employerCnpj_competence_kind_netAmount: { userId, employerCnpj: data.employerCnpj, competence: data.competence, kind: data.kind, netAmount: data.netAmount } }
const existing = await prisma.payslip.findUnique({ where })
if (existing) return { payslip: existing, created: false }
try {
	const created = await prisma.payslip.create({ data: { ...data, userId, items: { create: items } } })
	return { payslip: created, created: true }
} catch (error) {
	// Dois envios ao mesmo tempo: o outro gravou primeiro
	if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
		const payslip = await prisma.payslip.findUnique({ where })
		if (payslip) return { payslip, created: false }
	}
	throw error
}
```
(Confira o nome exato da chave composta no cliente gerado — `prisma/generated` — e o import de
`Prisma` usado no projeto: `grep -rn "PrismaClientKnownRequestError" src`; se não houver
exemplo, importe de `'../../../prisma/generated/client'`.)

**Verificar**: `bun run typecheck` → exit 0.

### Passo 4: Mostrar o tipo na lista

Em `payslip-list.tsx`, depois da competência, mostre ` · 13º` para `THIRTEENTH` e ` · Férias`
para `VACATION` (nada para `MONTHLY`). Garanta que a API/hook devolvem `kind`.

**Verificar**: `bun run check` → exit 0.

## Plano de testes

Se o plano 009 já separou `parsePayslipRows`, crie `src/lib/payslips/index.test.ts` com linhas
sintéticas (`PdfRow[][]`, empregador e CNPJ inventados) cobrindo: competência `10/2026` →
`MONTHLY`; `13/2026` → dezembro + `THIRTEENTH`; título com "FÉRIAS" → `VACATION`. Se não
separou, registre no relatório que os testes ficaram para depois.

## Critérios de pronto

- [ ] `bun run check` sai 0
- [ ] Migração `*_payslip_kind` criada com `DEFAULT 'MONTHLY'`
- [ ] `save.ts` trata P2002
- [ ] Linha do plano 011 em `plans/README.md` atualizada

## Condições de PARADA

- A migração não puder ser aplicada sem apagar dados.
- Outro código usa a chave `userId_employerCnpj_competence` além de `save.ts` (confira com grep).
- O holerite real do dono não tiver nenhum marcador de tipo e você não souber como distinguir —
  mantenha `MONTHLY` e reporte (não abra a pasta `extratos/`).

## Notas de manutenção

- Somas de renda por mês precisam considerar vários holerites no mesmo mês (hoje a tela só lista).
- Novos tipos (adiantamento, PLR) entram no enum com uma migração.
