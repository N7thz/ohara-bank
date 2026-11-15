# Plano 002: Fixar com testes o comportamento dos leitores de extrato e das contas com dinheiro

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- src/lib/statements src/lib/money.ts src/lib/currency-input.ts src/lib/tags.ts src/lib/merchants.ts src/lib/recurring.ts`
> Quando este plano foi escrito havia muitas mudanças não commitadas; confira os trechos de
> "Estado atual" direto nos arquivos. Se não baterem, PARE.

## Status

- **Prioridade**: P1
- **Esforço**: M
- **Risco**: LOW
- **Depende de**: plans/001-verificacao-base.md (precisa de `bun test` e `bun run check`)
- **Categoria**: tests
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

O trabalho central do app é transformar extratos bancários em valores certos no banco de
dados. A deduplicação de transações depende de um `externalId` estável: se a fórmula mudar,
reimportar um arquivo duplica todas as transações sem nenhum aviso. Hoje não há nenhum teste.
Este plano trava o comportamento ATUAL (testes de caracterização) dos leitores e das funções de
dinheiro, para que os planos 005 (correções nos leitores) e outros mudem o código com
segurança. Testes que documentam bugs conhecidos devem afirmar o comportamento atual, com um
comentário apontando o plano que vai corrigi-lo.

## Estado atual

- Convenção de testes (criada no plano 001): arquivo `<nome>.test.ts` ao lado do código,
  `import { describe, expect, test } from 'bun:test'`. Exemplo: `src/lib/format.test.ts`.
- **Fixtures sempre sintéticas**: nomes, CPF/CNPJ e valores inventados. NUNCA copie nada da
  pasta `extratos/` (dados bancários reais do dono).
- `src/lib/statements/types.ts`:
  ```ts
  export interface ParsedTransaction { externalId: string; date: Date; amount: number; description: string } // amount: negativo = saída
  export interface ParsedStatement { bankName: string; number: string; type: 'CHECKING' | 'CREDIT_CARD'; balance: number | null; balanceDate: Date | null; transactions: ParsedTransaction[] }
  ```
- `src/lib/statements/csv.ts`:
  - `export function hashIds(rows)` (linha ~74): `externalId = sha1("YYYY-MM-DD|amount|description|occurrence")`;
    linhas idênticas recebem ocorrência 0, 1, 2…
  - `export function parseCsv(content: string, options: StatementOptions = {})` (linha ~264).
  - Nubank conta: cabeçalho `Data,Valor,Identificador,Descrição` → usa o `Identificador`
    como `externalId`; um id repetido recebe sufixo `:reversal` (função `uniqueIds`).
    Número da conta vem do nome do arquivo: `NU_386835623_01SET2026_30SET2026.csv` → `38683562-3`.
  - Nubank cartão: cabeçalho de 3 colunas `date,title,amount`; compra positiva no arquivo vira
    negativa (`amount: -amount`), número `cartao`, tipo `CREDIT_CARD`.
  - CSV genérico sem `options.bankName`/`options.type` → lança `MissingAccountInfoError`.
  - Linhas cuja descrição começa com "saldo" são ignoradas.
  - `parseAmount` (privada): trata `R$`, `(10,00)` (negativo), sufixo `D` (negativo)/`C`, e
    decide decimal pela posição da última vírgula vs último ponto. **Bug conhecido**: `"1.234"`
    vira `1.234` (deveria ser 1234) — o plano 005 corrige; aqui o teste afirma `1.234`.
  - Coluna "tipo" (`amountFromRow`, ~linha 245): `/^(d|debito|saida)/` → negativo,
    `/^(c|credito|entrada)/` → positivo. **Bug conhecido**: "Compra" vira positivo — plano 005.
  - Cartão genérico: se mais da metade dos valores for positiva, inverte todos os sinais.
- `src/lib/statements/ofx.ts`: `export function isOfx(content)`, `export function parseOfx(content)`.
  Sem `<FITID>`, o id é `"YYYY-MM-DD|amount|description"` **sem** ocorrência (**bug conhecido**:
  duas compras iguais no mesmo dia viram o mesmo id — plano 005).
- `src/lib/statements/itau-card-pdf.ts`: `isItauCardStatement(pages: PdfItem[][])` e
  `parseItauCardStatement(pages: PdfItem[][])` são PURAS (recebem itens de texto já extraídos;
  `PdfItem = { text: string; x: number; y: number; width: number }` de `src/lib/pdf.ts`).
  A primeira página precisa conter "Resumo da fatura", "Cartão 4705.XXXX.XXXX.1234",
  "Emissão: DD/MM/AAAA" e "Lançamentos atuais <valor>"; as páginas seguintes têm duas colunas
  (datas da 2ª coluna ~218pt à direita da 1ª), seções "Lançamentos: compras e saques",
  "Lançamentos internacionais", "Compras parceladas - próximas faturas". Lança erro se a soma
  dos lançamentos não bater com o total impresso.
- `src/lib/money.ts`: `toMoney(value)` (`Math.round(Number(value.toString()) * 100)` centavos),
  `sumMoney`, `toReais`, `divideMoney(value, divisor)` (arredonda no centavo), `absMoney`,
  `zeroMoney`. Usa dinero.js.
- `src/lib/currency-input.ts`: `parseCurrency("1.234,56") → 1234.56`, `currencyInput(1234.56) → "1234,56"`.
- `src/lib/tags.ts:1` importa `prisma` (o que abre conexão com o banco ao carregar), mas a
  função pura `normalizeText` vive nele:
  ```ts
  export function normalizeText(text: string): string {
  	return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
  }
  ```
  `src/lib/merchants.ts:1` e `src/lib/recurring.ts` importam `normalizeText` de `./tags`, então
  testar `merchantName` carrega o Prisma e exige `DATABASE_URL`. `src/lib/prisma.ts` lança erro
  se `DATABASE_URL` não existir (após o plano 001).
- `src/lib/merchants.ts`: `merchantName(description)` remove prefixos bancários
  (`Compra no débito - `, `Transferência enviada pelo Pix - `, `PIX QRS `…) e de maquininha
  (`MP *`, `IFD*`); `merchantKey(name)`.

## Comandos que você vai usar

| Propósito | Comando | Esperado |
|---|---|---|
| Testes de um arquivo | `bun test src/lib/statements/csv.test.ts` | todos passam |
| Tudo | `bun run check` | exit 0 |

## Escopo

**Dentro do escopo**:
- `src/lib/text.ts` (criar) — recebe `normalizeText`
- `src/lib/tags.ts` — passa a reexportar `normalizeText` de `./text` (sem mudar comportamento)
- `src/lib/merchants.ts`, `src/lib/recurring.ts` — só trocar o import para `./text`
- Criar: `src/lib/statements/csv.test.ts`, `src/lib/statements/ofx.test.ts`,
  `src/lib/statements/itau-card-pdf.test.ts`, `src/lib/money.test.ts`,
  `src/lib/currency-input.test.ts`, `src/lib/merchants.test.ts`

**Fora do escopo**:
- Qualquer mudança de comportamento em `csv.ts`, `ofx.ts`, `itau-card-pdf.ts`, `money.ts`
  (os bugs ficam para o plano 005 — aqui só se testa).
- `src/lib/statements/itau-pdf.ts` e `src/lib/payslips/*` (leem PDF binário; ficam para depois).
- `src/components/ui/*`.

## Fluxo de git

Não commite, não faça stash nem checkout (o dono tem trabalho não commitado e commita ele
mesmo). Se instruído a commitar: `test: ...` em pt-BR, só os arquivos deste plano.

## Passos

### Passo 1: Tirar `normalizeText` do módulo que importa o Prisma

1. Crie `src/lib/text.ts` com a função `normalizeText` exatamente como está em `tags.ts`.
2. Em `src/lib/tags.ts`, apague a definição e adicione `export { normalizeText } from './text'`
   (outros arquivos continuam importando de `@/lib/tags` sem quebrar).
3. Em `src/lib/merchants.ts` e `src/lib/recurring.ts`, troque `from './tags'` por `from './text'`
   apenas para `normalizeText`.

**Verificar**: `bunx tsc --noEmit` → exit 0; `grep -n "normalizeText" src/lib/text.ts` → 1 definição.

### Passo 2: `src/lib/money.test.ts` e `src/lib/currency-input.test.ts`

Casos (tabela com `test.each`):
- `toReais(toMoney(10.1))` → `10.1`; `toReais(toMoney('123.45'))` → `123.45`;
  `toReais(toMoney(-0.01))` → `-0.01`; `toReais(toMoney(1.005))` → registre o valor atual (não
  "corrija").
- `toReais(sumMoney([toMoney(0.1), toMoney(0.2)]))` → `0.3` (prova que não há erro de float).
- `toReais(divideMoney(toMoney(100), 3))` → `33.33`; `toReais(absMoney(toMoney(-5.5)))` → `5.5`.
- `parseCurrency('1.234,56')` → `1234.56`; `parseCurrency('abc')` → `NaN`;
  `currencyInput(1234.5)` → `'1234,50'`.

**Verificar**: `bun test src/lib/money.test.ts src/lib/currency-input.test.ts` → todos passam.

### Passo 3: `src/lib/statements/csv.test.ts`

Monte CSVs como strings no próprio teste. Casos mínimos:
1. **Nubank conta** (`Data,Valor,Identificador,Descrição`, 3 linhas, uma com id repetido) com
   `fileName: 'NU_123456789_01SET2026_30SET2026.csv'` → `bankName 'Nubank'`, `number '12345678-9'`,
   `type 'CHECKING'`, ids iguais aos do arquivo, o repetido com sufixo `:reversal`.
2. **Nubank cartão** (`date,title,amount`) → valores com sinal invertido, `type 'CREDIT_CARD'`,
   `number 'cartao'`.
3. **Estabilidade do id**: parsear o mesmo conteúdo duas vezes → `externalId`s idênticos;
   e fixe o valor exato de um `externalId` gerado por `hashIds` (copie o valor que o teste
   imprimir na primeira execução — é o "snapshot" que protege contra mudança de fórmula).
4. **Duas compras idênticas no mesmo dia** via `hashIds` → dois ids diferentes.
5. **CSV genérico sem banco/tipo** → `toThrow(MissingAccountInfoError)`.
6. **CSV genérico com** `{ bankName: 'Banco X', type: 'CHECKING' }`, separador `;`, valores
   `"1.234,56"`, `"(10,00)"`, `"10,00 D"`, e uma linha "Saldo anterior" → valores
   `1234.56`, `-10`, `-10`; linha de saldo ignorada.
7. **Bugs conhecidos (afirmar comportamento ATUAL)**, cada um com comentário
   `// BUG conhecido — muda no plano 005`: valor `"1.234"` → `1.234`; coluna `Tipo` = `Compra`
   com valor `50,00` → `+50`.
8. **Cartão genérico** (`type: 'CREDIT_CARD'`) com maioria positiva → sinais invertidos.

**Verificar**: `bun test src/lib/statements/csv.test.ts` → todos passam.

### Passo 4: `src/lib/statements/ofx.test.ts`

OFX mínimo sintético com `<BANKID>260`, `<ACCTID>123`, dois `<STMTTRN>` com `<FITID>`, e um
terceiro par de transações idênticas SEM `<FITID>`. Casos: `isOfx` verdadeiro; ids = FITID;
e para o par sem FITID, afirme o comportamento atual (mesmo id nos dois, comentário
`// BUG conhecido — muda no plano 005`). Se o parser exigir tags que você não incluiu, leia
`src/lib/statements/ofx.ts` e acrescente-as ao fixture (não mude o parser).

**Verificar**: `bun test src/lib/statements/ofx.test.ts` → todos passam.

### Passo 5: `src/lib/statements/itau-card-pdf.test.ts`

Monte `PdfItem[][]` à mão (página 1 com itens nas posições que formam as linhas do cabeçalho;
página 2 com coluna esquerda em `x: 133` e direita em `x: 351`, datas `DD/MM`, valores no fim
da linha). Casos: fatura com 3 compras + 1 estorno (valor negativo vira positivo) + 1 parcela
"LOJA 02/05" (data = emissão) + "Pagamento via conta" na seção de pagamentos (ignorado), com
"Lançamentos atuais" igual à soma → retorna `type 'CREDIT_CARD'`, `number 'cartão 1234'`;
e o mesmo com total errado → lança erro contendo "não bate".

**Verificar**: `bun test src/lib/statements/itau-card-pdf.test.ts` → todos passam.

### Passo 6: `src/lib/merchants.test.ts`

Casos com descrições sintéticas: `'Compra no débito - PADARIA EXEMPLO'` → `'PADARIA EXEMPLO'`;
`'Transferência enviada pelo Pix - FULANO DE TAL - •••.111.222-•• - BANCO'` → registre o
retorno atual; `'MP *BARBEARIA X'` → sem o `MP *`. Registre os valores atuais como esperados.

**Verificar**: `bun test src/lib/merchants.test.ts` → passa SEM `DATABASE_URL` no ambiente
(rode `DATABASE_URL= bun test src/lib/merchants.test.ts`).

### Passo 7: Portão final

**Verificar**: `bun run check` → exit 0.

## Plano de testes

É o próprio plano: 6 arquivos novos, ~30 casos. Modelo de estrutura: `src/lib/format.test.ts`.

## Critérios de pronto

- [ ] `bun run check` sai 0
- [ ] `bun test` lista os 6 arquivos novos, todos passando
- [ ] `DATABASE_URL= bun test src/lib/merchants.test.ts` passa
- [ ] `git diff --stat -- src/lib/statements/csv.ts src/lib/statements/ofx.ts src/lib/statements/itau-card-pdf.ts src/lib/money.ts` → vazio (nenhuma mudança de comportamento)
- [ ] Nenhum fixture contém dado copiado de `extratos/`
- [ ] Linha do plano 002 em `plans/README.md` atualizada

## Condições de PARADA

- Algum teste só passa mudando o código de produção (pare: isso é escopo do plano 005).
- `merchants.test.ts` continua exigindo `DATABASE_URL` depois do passo 1 (há outra cadeia de import do Prisma — reporte qual).
- `parseItauCardStatement` não aceita os itens montados à mão depois de 2 tentativas razoáveis (reporte o erro).
- O plano 001 não está concluído (`bun run check` não existe).

## Notas de manutenção

- O teste de "id exato" (passo 3, caso 3) é proposital: se ele quebrar, reimportar extratos
  vai duplicar transações. Só atualize o valor esperado com uma migração de ids planejada.
- O plano 005 vai inverter as expectativas marcadas `BUG conhecido`.
- Adiado: testes dos leitores que recebem PDF binário (`itau-pdf.ts`, `payslips/index.ts`) —
  exigem separar "ler PDF" de "interpretar linhas".
