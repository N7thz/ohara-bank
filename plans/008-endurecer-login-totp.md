# Plano 008: Login por código (TOTP) com limite de tentativas à prova de corrida, código de uso único e segredo protegido

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- src/lib/auth prisma/schema/auth.prisma src/app/api/security "src/app/(pages)/dashboard/security"`
> Confira os trechos de "Estado atual" direto nos arquivos (havia mudanças não commitadas).
>
> **Leia antes de codar**: `AGENTS.md` (esta versão do Next.js tem mudanças incompatíveis; leia
> o guia relevante em `node_modules/next/dist/docs/`) e a API de hooks do better-auth instalado
> em `node_modules/better-auth/dist` (procure `createAuthMiddleware` e `hooks`).

## Status

- **Prioridade**: P2 (P1 se o app for publicado na internet)
- **Esforço**: M
- **Risco**: MED — um erro aqui pode trancar o dono fora do login de reserva. Recuperação
  existente: `bun run auth:reset-totp` (recria o autenticador pelo terminal).
- **Depende de**: plans/001-verificacao-base.md
- **Categoria**: security
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

O app é de um usuário só, sem senha: entra com passkey ou, de reserva, só com o código de 6
dígitos do autenticador (`/api/auth/totp-sign-in`). Esse login de reserva tem três falhas:
1. **Corrida no limite de tentativas**: lê `failedVerificationCount`, verifica o código e só
   depois grava `+1`. Várias requisições simultâneas leem o mesmo contador, então o bloqueio de
   5 tentativas / 15 min não segura uma rajada de palpites.
2. **Código reaproveitável**: a verificação aceita o código do passo anterior, atual e próximo
   (janela padrão = 1) e nunca registra o código usado; o mesmo código serve por ~90 s.
3. **Status público com números**: `GET /api/security/totp/login-status` (sem login) devolve
   `failedAttempts`, `maxAttempts` e `lockedUntil`, o que permite dosar palpites.
Além disso, quem rouba uma sessão por alguns minutos consegue gerar um novo segredo TOTP ou
registrar uma passkey própria (só exigem sessão), ganhando acesso permanente.

## Estado atual

- `src/lib/auth/totp-sign-in.ts` (plugin do better-auth; constantes `MAX_ATTEMPTS = 5`,
  `LOCK_MINUTES = 15`). Trecho central (~linhas 49-83):
  ```ts
  if (twoFactor.lockedUntil && new Date(twoFactor.lockedUntil) > new Date()) {
  	throw APIError.from('TOO_MANY_REQUESTS', { code: 'TOTP_LOCKED', message: 'Muitas tentativas. Tente de novo em alguns minutos.' })
  }
  const secret = await symmetricDecrypt({ key: ctx.context.secretConfig, data: twoFactor.secret })
  const valid = await createOTP(secret, { digits: 6, period: 30 }).verify(ctx.body.code)
  if (!valid) {
  	const failures = (twoFactor.failedVerificationCount ?? 0) + 1
  	const locked = failures >= MAX_ATTEMPTS
  	await ctx.context.adapter.update({ model: 'twoFactor', where: [{ field: 'id', value: twoFactor.id }],
  		update: { failedVerificationCount: locked ? 0 : failures, lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null } })
  	throw invalid()
  }
  await ctx.context.adapter.update({ model: 'twoFactor', where: [{ field: 'id', value: twoFactor.id }], update: { failedVerificationCount: 0, lockedUntil: null } })
  const session = await ctx.context.internalAdapter.createSession(found.user.id)
  await setSessionCookie(ctx, { session, user: found.user })
  ```
- `@better-auth/utils/otp` (`node_modules/@better-auth/utils/dist/otp.mjs`): `createOTP(secret,
  { digits, period })` devolve `{ hotp(counter), totp(), verify(otp, { window }) }`.
  `hotp(counter)` gera o código de um passo específico; passo = `Math.floor(Date.now() / 30000)`.
- `prisma/schema/auth.prisma` — modelo `TwoFactor` (tabela `twoFactor`): `id`, `secret`,
  `backupCodes`, `verified Boolean? @default(true)`, `failedVerificationCount Int? @default(0)`,
  `lockedUntil DateTime?`, `userId`. Regra do dono: o schema do Prisma fica dividido em
  arquivos por domínio em `prisma/schema/` — edite `auth.prisma`, nunca crie um `schema.prisma` único.
- `src/lib/auth/totp-status.ts` — `getTotpStatus(userId)` devolve
  `{ status, failedAttempts, maxAttempts, lockedUntil }`; usado pela rota pública
  `src/app/api/security/totp/login-status/route.ts` e (confira com grep) pela tela de Segurança.
- `src/lib/auth/index.ts` — `betterAuth({ appName, database: prismaAdapter(prisma, …), plugins: [passkey(...), twoFactor({ allowPasswordless: true }), totpSignIn(), nextCookies()] })`.
- Telas que chamam endpoints sensíveis (`src/app/(pages)/dashboard/security/_components/`):
  `two-factor-setup.tsx:77` `authClient.twoFactor.enable({})`, `:68` `authClient.twoFactor.disable({})`,
  `passkey-manager.tsx:40` `authClient.passkey.addPasskey(...)`.
- Migrações: `bun run db:migrate` (= `bunx --bun prisma migrate dev`); usa `DIRECT_URL`.

## Comandos que você vai usar

| Propósito | Comando | Esperado |
|---|---|---|
| Migração | `bun run db:migrate --name totp_last_step` | migração criada e aplicada |
| Cliente Prisma | `bun run db:generate` | exit 0 |
| Testes | `bun test src/lib/auth` | todos passam |
| Tudo | `bun run check` | exit 0 |

## Escopo

**Dentro do escopo**: `src/lib/auth/totp-sign-in.ts`, `src/lib/auth/totp-status.ts`,
`src/lib/auth/index.ts`, `src/app/api/security/totp/login-status/route.ts`,
`prisma/schema/auth.prisma` + a migração nova, `src/lib/auth/totp-step.ts` e
`src/lib/auth/totp-step.test.ts` (criar), e os 2 componentes de Segurança (só tratar o erro novo).

**Fora do escopo**: trocar o método de login, mexer em passkey além do bloqueio de "sessão
recente", `prisma/seed.ts`, dados existentes.

## Fluxo de git

Não commite, não faça stash nem checkout. Se instruído: `fix: ...` em pt-BR, só estes arquivos
(incluindo a pasta da migração nova).

## Passos

### Passo 1: Coluna do último passo usado

Em `prisma/schema/auth.prisma`, no modelo `TwoFactor`, acrescente `lastUsedStep Int?`.
Rode `bun run db:migrate --name totp_last_step` e `bun run db:generate`.

**Verificar**: existe `prisma/migrations/*_totp_last_step/migration.sql` com `ADD COLUMN "lastUsedStep"`;
`bun run typecheck` → exit 0.

### Passo 2: Função pura para achar o passo do código

Crie `src/lib/auth/totp-step.ts`:
```ts
import { createOTP } from '@better-auth/utils/otp'

/** Passo (janela de 30 s) em que o código vale, entre o anterior, o atual e o próximo; null se nenhum */
export async function matchingStep(secret: string, code: string, now = Date.now()) {
	const otp = createOTP(secret, { digits: 6, period: 30 })
	const current = Math.floor(now / 30_000)
	for (const step of [current - 1, current, current + 1]) {
		if ((await otp.hotp(step)) === code) return step
	}
	return null
}
```
Teste em `totp-step.test.ts`: com um segredo fixo de teste, gere `await createOTP(s).hotp(step)`
para `step = Math.floor(now/30000)` e confira que `matchingStep` devolve esse passo; código
errado → `null`; código de 2 passos atrás → `null`.

**Verificar**: `bun test src/lib/auth` → todos passam.

### Passo 3: Reservar a tentativa ANTES de verificar (atômico) e recusar código repetido

Em `totp-sign-in.ts`, use `prisma` (de `@/lib/prisma`) para as escritas atômicas:
1. Logo após achar `twoFactor` verificado, reserve uma tentativa com um único UPDATE condicional:
   ```ts
   const reserved = await prisma.twoFactor.updateMany({
   	where: {
   		id: twoFactor.id,
   		OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }],
   		failedVerificationCount: { lt: MAX_ATTEMPTS },
   	},
   	data: { failedVerificationCount: { increment: 1 }, lockedUntil: null },
   })
   if (reserved.count === 0) {
   	// Esgotou: bloqueia (se ainda não estava) e recusa
   	await prisma.twoFactor.updateMany({
   		where: { id: twoFactor.id, OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }] },
   		data: { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000), failedVerificationCount: 0 },
   	})
   	throw APIError.from('TOO_MANY_REQUESTS', { code: 'TOTP_LOCKED', message: 'Muitas tentativas. Tente de novo em alguns minutos.' })
   }
   ```
   ATENÇÃO: confira se `failedVerificationCount` pode ser `null` no banco; se puder, inclua
   `{ failedVerificationCount: null }` no `OR` do contador ou rode antes um
   `updateMany({ where: { failedVerificationCount: null }, data: { failedVerificationCount: 0 } })`.
2. Verifique com `const step = await matchingStep(secret, ctx.body.code)`. Inválido se `step === null`
   OU `twoFactor.lastUsedStep !== null && step <= twoFactor.lastUsedStep` → `throw invalid()`
   (a tentativa já foi contada no item 1).
3. Válido: grave de forma condicional para impedir dois logins com o mesmo código ao mesmo tempo:
   ```ts
   const consumed = await prisma.twoFactor.updateMany({
   	where: { id: twoFactor.id, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
   	data: { lastUsedStep: step, failedVerificationCount: 0, lockedUntil: null },
   })
   if (consumed.count === 0) throw invalid()
   ```
   e só então crie a sessão (código atual de `createSession`/`setSessionCookie`).
4. Remova a escrita antiga via `ctx.context.adapter.update`.

**Verificar**: `bun run typecheck` → exit 0.

### Passo 4: Status público sem números

Em `src/app/api/security/totp/login-status/route.ts`, devolva só
`{ status }` (`'connected' | 'pending' | 'locked' | 'not-configured'`) e `lockedUntil` apenas
quando `status === 'locked'`. Mantenha `getTotpStatus` completo para uso autenticado (tela de
Segurança). Confira com `grep -rn "failedAttempts\|maxAttempts" "src/app/(pages)" src/hooks` quem lê
esses campos; se for a tela de LOGIN pública, adapte-a para não depender deles.

**Verificar**: `bun run typecheck` → exit 0.

### Passo 5: Exigir sessão recente para mexer no autenticador e nas passkeys

Em `src/lib/auth/index.ts`, adicione um hook "before" do better-auth que, para os caminhos
`/two-factor/enable`, `/two-factor/disable`, `/two-factor/get-totp-uri`,
`/passkey/generate-register-options` e `/passkey/verify-registration`, obtém a sessão e recusa
com `APIError.from('FORBIDDEN', { code: 'SESSION_NOT_FRESH', message: 'Entre de novo para alterar a segurança da conta.' })`
quando `session.session.createdAt` tiver mais de 10 minutos. Use a API de hooks do better-auth
INSTALADO (procure `createAuthMiddleware` em `node_modules/better-auth/dist`); confirme os nomes
exatos dos caminhos de passkey no código do plugin `@better-auth/passkey` instalado.
Nos componentes `two-factor-setup.tsx` e `passkey-manager.tsx`, quando o erro tiver
`code === 'SESSION_NOT_FRESH'`, mostre a mensagem (toast) dizendo para sair e entrar de novo.

**Verificar**: `bun run typecheck` → exit 0; `bun run check` → exit 0.

### Passo 6: Teste manual guiado (o dono faz; você documenta)

Escreva no final da sua mensagem de conclusão os passos para o dono testar: (a) login com
código certo funciona; (b) o mesmo código uma segunda vez dentro de 30 s é recusado;
(c) 5 códigos errados bloqueiam; (d) em sessão com mais de 10 min, "Ativar autenticador" pede
novo login. Lembre o comando de recuperação `bun run auth:reset-totp`.

## Critérios de pronto

- [ ] `bun run check` sai 0
- [ ] Migração `*_totp_last_step` criada em `prisma/migrations/`
- [ ] `grep -n "ctx.context.adapter.update" src/lib/auth/totp-sign-in.ts` → nenhuma linha
- [ ] `GET /api/security/totp/login-status` não devolve `failedAttempts` (confira no código)
- [ ] Linha do plano 008 em `plans/README.md` atualizada

## Condições de PARADA

- A API de hooks do better-auth instalado não permite interceptar esses caminhos — reporte o
  que existe em vez de inventar.
- `prisma.twoFactor` não existir no cliente gerado (o modelo pode ter outro nome) ou a migração falhar.
- A tela de login pública depende de `failedAttempts` de um jeito que exigiria redesenhar o fluxo.
- Qualquer passo fizer o login com passkey parar de funcionar.

## Notas de manutenção

- Se algum dia houver mais de um usuário, o login só por código precisa ser repensado
  (hoje vale apenas para `ADMIN_EMAIL`).
- Se uma sessão for suspeita de roubo: `bun run auth:reset-totp` e apagar passkeys desconhecidas.
- Adiado: rate limit por IP (o better-auth só limita em produção por padrão) e cabeçalhos de
  segurança HTTP — relevantes só se o app for publicado.
