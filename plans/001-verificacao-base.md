# Plano 001: Ter um comando único de verificação (`bun run check`) que passa

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- package.json biome.json src/lib/prisma.ts src/app/layout.tsx`
> Atenção: quando este plano foi escrito, a árvore de trabalho tinha MUITAS mudanças não
> commitadas (os trechos abaixo refletem a árvore de trabalho, não o commit `84bba39`).
> Portanto confira os trechos de "Estado atual" diretamente nos arquivos; se não baterem,
> trate como condição de PARADA.

## Status

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: LOW
- **Depende de**: nenhum
- **Categoria**: dx
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

O projeto não tem testes, não tem script de typecheck e o `bun run lint` (`biome check`)
sempre falha: dos 35 erros, 33 estão em componentes gerados pelo shadcn (`src/components/ui/*`)
ou são sintaxe do Tailwind v4 em `src/app/globals.css` que o Biome não entende sem
configuração. Sem um comando que passa, nenhum outro plano consegue provar que não quebrou
nada. Ao final deste plano existe `bun run check` (typecheck + lint + testes) que sai com
código 0, e é ele que todos os outros planos usam como portão.

## Estado atual

- `package.json:5-21` — scripts. Não há `typecheck`, `test` nem `check`:
  ```json
  "scripts": {
  	"dev": "next dev",
  	"build": "next build",
  	"start": "next start",
  	"lint": "biome check",
  	"format": "biome format --write",
  	"email": "email dev --dir src/emails --port 3001",
  	"db:generate": "bunx --bun prisma generate",
  	...
  	"auth:reset-totp": "bun prisma/seed.ts --reset-totp"
  },
  ```
- `biome.json` (inteiro, Biome 2.5.15) — sem `css.parser.tailwindDirectives` e sem `overrides`:
  ```json
  "files": { "ignoreUnknown": false, "includes": ["**", "!.next", "!node_modules", "!prisma/generated"] },
  "linter": { "enabled": true, "rules": { "preset": "recommended", "suspicious": { "noUnknownAtRules": "off" } } },
  "javascript": { "formatter": { "quoteStyle": "single", "trailingCommas": "all", "semicolons": "asNeeded" } }
  ```
- `src/components/ui/*` são arquivos **gerados pelo shadcn**. Regra do dono do projeto: NUNCA
  rode `biome check --write`/`biome format --write` sobre essa pasta (gera diffs que conflitam
  com `shadcn add`). Silencie-os por configuração, não editando os arquivos.
- `src/app/globals.css` usa diretivas do Tailwind v4 (`@source`, `@theme inline`,
  `@custom-variant`, `@import "tailwindcss"`) e tem `!important` dentro de
  `@media (prefers-reduced-motion: reduce)` (proposital, para zerar animações).
- Únicos 2 problemas em código do app (não gerado):
  - `src/lib/prisma.ts:8` — `noNonNullAssertion`:
    ```ts
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
    ```
  - `src/app/layout.tsx:30` — `noUselessFragments`: o JSX retornado começa com `<>` envolvendo
    só `<html ...>`.
- Arquivos que só têm problema de formatação: `components.json`, `package.json`,
  `skills-lock.json` (este último é gerado por ferramenta; ignore-o no Biome).
- Runtime: bun 1.3.10 (tem `bun test` embutido; não instale Jest/Vitest). `bunx tsc --noEmit`
  já passa hoje (exit 0).
- Não existe nenhum arquivo `*.test.ts` no repositório.

## Comandos que você vai usar

| Propósito | Comando | Esperado |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Lint (checagem) | `bunx biome check` | exit 0 ao final do plano |
| Testes | `bun test` | exit 0 |
| Tudo | `bun run check` | exit 0 |

## Escopo

**Dentro do escopo** (os únicos arquivos que você pode modificar/criar):
- `package.json` (só a seção `scripts` e a formatação do arquivo)
- `biome.json`
- `src/lib/prisma.ts` (só a linha do `DATABASE_URL`)
- `src/app/layout.tsx` (só remover o fragmento inútil)
- `components.json` (só formatação)
- `src/lib/format.test.ts` (criar — teste-semente)

**Fora do escopo** (NÃO toque):
- Qualquer arquivo em `src/components/ui/` — gerado pelo shadcn.
- `src/app/globals.css` — o conteúdo é proposital; resolva por configuração do Biome.
- Dependências (`bun add`/`bun remove`) — não instale nada.

## Fluxo de git

- O dono do projeto trabalha direto em `master` e tem muito trabalho não commitado de outras
  tarefas. **Não commite, não faça stash, não faça checkout.** Deixe as mudanças na árvore de
  trabalho; o dono revisa e commita. Se for instruído a commitar, use o estilo do repositório
  (`feat: ...`/`chore: ...` em pt-BR, ex.: `feat: finanças pessoais com extratos, tags, dívidas e novo design`)
  e adicione só os arquivos deste plano, nunca `git add -A`.

## Passos

### Passo 1: Adicionar os scripts

Em `package.json`, dentro de `scripts`, adicione (mantendo os existentes):
```json
"typecheck": "tsc --noEmit",
"test": "bun test",
"check": "bun run typecheck && bun run lint && bun run test"
```
**Verificar**: `bun run typecheck` → exit 0.

### Passo 2: Ensinar o Biome sobre Tailwind e silenciar o código gerado

Em `biome.json`:
1. Adicione `"css": { "parser": { "tailwindDirectives": true } }` no nível raiz.
2. Em `files.includes`, acrescente `"!skills-lock.json"`.
3. Adicione `overrides` que desliga o linter (mas mantém o formatter desligado também, para não
   reformatar código gerado) em `src/components/ui/**`:
   ```json
   "overrides": [
   	{
   		"includes": ["src/components/ui/**"],
   		"linter": { "enabled": false },
   		"formatter": { "enabled": false },
   		"assist": { "enabled": false }
   	},
   	{
   		"includes": ["src/app/globals.css"],
   		"linter": { "rules": { "complexity": { "noImportantStyles": "off" }, "correctness": { "noInvalidPositionAtImportRule": "off" } } }
   	}
   ]
   ```
   Se o Biome 2.5.15 rejeitar alguma chave (o comando abaixo mostra "Found an unknown key"),
   consulte `node_modules/@biomejs/biome/configuration_schema.json` para o nome correto e ajuste.
   Se a regra `noInvalidPositionAtImportRule` estiver em outro grupo, use o grupo indicado na
   mensagem de diagnóstico.

**Verificar**: `bunx biome check --max-diagnostics=50` → nenhum diagnóstico em
`src/components/ui/` nem erro de parse em `src/app/globals.css`. Podem restar só os itens dos
passos 3–4.

### Passo 3: Corrigir os 2 problemas do código do app

- `src/lib/prisma.ts:8`: troque o `!` por uma falha explícita:
  ```ts
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL não definido')
  const adapter = new PrismaPg({ connectionString })
  ```
- `src/app/layout.tsx`: remova o `<>`/`</>` que envolve apenas o `<html>`.

**Verificar**: `bunx tsc --noEmit` → exit 0.

### Passo 4: Formatar só os arquivos de configuração

Rode `bunx biome format --write package.json components.json biome.json` (apenas esses três).

**Verificar**: `bunx biome check` → exit 0 (zero erros). Avisos (warnings) podem existir; se
houver erro restante, corrija só se estiver num arquivo do escopo; senão PARE.

### Passo 5: Teste-semente para provar que `bun test` funciona

Crie `src/lib/format.test.ts` testando uma função pura de `src/lib/format.ts`
(`formatCurrency(value: number)` usa `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`):
```ts
import { describe, expect, test } from 'bun:test'
import { formatCurrency } from './format'

describe('formatCurrency', () => {
	test('formata em reais', () => {
		// toLocaleString usa espaço não separável (U+00A0) entre "R$" e o número
		expect(formatCurrency(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
	})
	test('negativo', () => {
		expect(formatCurrency(-10).replace(/\s/g, ' ')).toBe('-R$ 10,00')
	})
})
```
Se `src/lib/format.ts` importar algo que exija banco/ambiente e o teste falhar ao carregar, PARE.

**Verificar**: `bun test` → 2 pass, 0 fail.

### Passo 6: Portão final

**Verificar**: `bun run check` → exit 0.

## Plano de testes

- `src/lib/format.test.ts` (novo): 2 casos acima. Convenção para os próximos planos: testes ao
  lado do código, `<arquivo>.test.ts`, usando `bun:test`. Fixtures sempre sintéticas (nunca
  copie nada da pasta `extratos/`, que tem dados bancários reais).

## Critérios de pronto

- [ ] `bun run typecheck` sai 0
- [ ] `bunx biome check` sai 0
- [ ] `bun test` sai 0 com 2 testes passando
- [ ] `bun run check` sai 0
- [ ] `git status --short src/components/ui` não mostra mudanças feitas por você
- [ ] Linha do plano 001 em `plans/README.md` atualizada

## Condições de PARADA

- `bunx tsc --noEmit` falha ANTES de você mudar qualquer coisa (o baseline mudou).
- Silenciar `src/components/ui/**` exige editar arquivos dentro dessa pasta.
- Restam erros do Biome em arquivos fora do escopo depois do passo 4 (liste-os e pare).
- `bun test` não encontra `bun:test` ou exige instalar pacote.

## Notas de manutenção

- Novos componentes shadcn (`bunx shadcn add`) caem em `src/components/ui/` e continuam
  ignorados pelo lint — é intencional.
- Todo plano seguinte usa `bun run check` como portão; não o enfraqueça para "passar".
- Adiado: CI (GitHub Actions) — sem remoto/CI hoje; quando houver, o job é só
  `bun install --frozen-lockfile && bun run db:generate && bun run check`.
