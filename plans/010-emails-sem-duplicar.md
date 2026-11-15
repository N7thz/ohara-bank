# Plano 010: E-mails nunca saem em dobro e resumos só saem com todas as contas importadas

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- src/lib/email prisma/schema/email.prisma`
> `src/lib/email/*` e `prisma/schema/` estavam NÃO commitados quando o plano foi escrito;
> confira os trechos de "Estado atual" direto nos arquivos. Se não baterem, PARE.

## Status

- **Prioridade**: P2
- **Esforço**: M
- **Risco**: LOW (no pior caso um e-mail atrasa; nunca deve sair a mais)
- **Depende de**: plans/001-verificacao-base.md
- **Categoria**: bug
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

O app manda e-mails (lembrete de contas, resumo semanal/mensal, alerta de orçamento) a partir
de um timer dentro do servidor e também logo depois de cada importação. Três problemas:
1. A trava "uma verificação por vez" é uma variável de módulo (`let running`); a rota de
   importação, a rota "Verificar agora" e o `instrumentation.ts` podem ter instâncias separadas
   do módulo, então duas verificações podem rodar juntas e mandar o mesmo e-mail duas vezes.
2. Se o envio der certo mas a gravação do registro (`emailLog`) falhar, o código registra como
   FALHA sem as chaves — e o mesmo e-mail é reenviado uma hora depois.
3. O resumo semanal/mensal decide que o período está "coberto" pela transação mais recente de
   QUALQUER conta. Importar só o cartão faz sair um resumo sem as outras contas, e como a chave
   fica gravada, ele nunca é corrigido.

## Estado atual

- `src/lib/email/scheduler.ts` (38 linhas):
  ```ts
  const globalForScheduler = globalThis as unknown as { emailScheduler?: NodeJS.Timeout }
  let running = false
  export async function checkEmails(options?: Parameters<typeof runEmailJobs>[0]) {
  	if (running) return []
  	running = true
  	try { const results = await runEmailJobs(options); /* console.log/error por resultado */ return results }
  	catch (error) { console.error('[e-mail] erro ao verificar e-mails', error); return [] }
  	finally { running = false }
  }
  ```
  Chamadores: `src/instrumentation.ts` (via `startEmailScheduler`), `src/app/api/finance/import/route.ts`
  (dentro de `after(...)`), `src/app/api/notifications/run/route.ts`.
- `src/lib/email/jobs.tsx`:
  - `sentKeys(userId)` (~linha 275): `Set` com as `keys` dos `emailLog` sem erro dos últimos 120 dias.
  - `deliver(user, email)` (~linha 285):
    ```ts
    try {
    	await sendEmail({ to: user.email, subject: email.subject, html: email.html, text: email.text })
    	await prisma.emailLog.create({ data: { userId: user.id, kind: email.kind, subject: email.subject, keys: email.keys } })
    	return { kind: email.kind, subject: email.subject, error: null }
    } catch (error) {
    	const message = error instanceof Error ? error.message : String(error)
    	await prisma.emailLog.create({ data: { userId: user.id, kind: email.kind, subject: email.subject, keys: [], error: message } })
    	return { kind: email.kind, subject: email.subject, error: message }
    }
    ```
  - `runEmailJobs` (~linha 312): para cada usuário, lê `sentKeys`, monta até 4 e-mails
    (`billsEmail`, `weeklyEmail`, `monthlyEmail`, `budgetEmail`, cada um recebendo `sent` e
    devolvendo `null` se a chave já foi enviada) e chama `deliver` para cada um.
  - `weeklyEmail` (~linha 140) e `monthlyEmail` (~linha 186) usam `importedUntil(userId)` para
    decidir se o período está coberto (`until >= fim do período`).
- `src/lib/email/reports.ts:~122`:
  ```ts
  export async function importedUntil(userId: string) {
  	const last = await prisma.transaction.findFirst({ where: { account: { userId } }, orderBy: { date: 'desc' }, select: { date: true } })
  	return last?.date ?? null
  }
  ```
- `prisma/schema/email.prisma` — modelo `EmailLog` (`id, userId, kind, subject, keys String[], error String?, sentAt`), `@@index([userId, sentAt])`.
  Regra do dono: schema dividido por domínio em `prisma/schema/`; edite `email.prisma`.

## Comandos que você vai usar

| Propósito | Comando | Esperado |
|---|---|---|
| Migração | `bun run db:migrate --name email_key_claim` | criada e aplicada |
| Cliente Prisma | `bun run db:generate` | exit 0 |
| Tudo | `bun run check` | exit 0 |

## Escopo

**Dentro do escopo**: `src/lib/email/scheduler.ts`, `src/lib/email/jobs.tsx`,
`src/lib/email/reports.ts`, `prisma/schema/email.prisma` + migração nova.

**Fora do escopo**: conteúdo/visual dos e-mails (`src/emails/*`), horários, configurações,
transporte SMTP, rotas de API.

## Fluxo de git

Não commite, não faça stash nem checkout. Se instruído: `fix: ...` em pt-BR, só estes arquivos.

## Passos

### Passo 1: Trava no `globalThis`

Em `scheduler.ts`, troque `let running = false` por um campo no mesmo objeto global do timer:
`const globalForScheduler = globalThis as unknown as { emailScheduler?: NodeJS.Timeout; emailRunning?: boolean }`
e use `globalForScheduler.emailRunning` no lugar de `running`.

**Verificar**: `bun run typecheck` → exit 0; `grep -n "let running" src/lib/email/scheduler.ts` → nada.

### Passo 2: Reivindicar as chaves no banco ANTES de enviar

Em `email.prisma`, adicione:
```prisma
/// Chave de aviso reservada antes do envio: impede dois envios do mesmo aviso
model EmailKeyClaim {
  userId    String
  key       String
  claimedAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, key])
  @@map("email_key_claim")
}
```
e a relação inversa `emailKeyClaims EmailKeyClaim[]` no modelo `User` (em `prisma/schema/auth.prisma`
— é o único arquivo fora de `email.prisma` que você pode tocar, só para essa linha).
Rode `bun run db:migrate --name email_key_claim` e `bun run db:generate`.

Em `deliver`, antes de `sendEmail`:
```ts
if (email.keys.length > 0) {
	const claimed = await prisma.emailKeyClaim.createMany({
		data: email.keys.map((key) => ({ userId: user.id, key })),
		skipDuplicates: true,
	})
	// Outra verificação já pegou (alguma de) essas chaves: não envia
	if (claimed.count < email.keys.length) {
		await prisma.emailKeyClaim.deleteMany({ where: { userId: user.id, key: { in: email.keys }, claimedAt: { gte: startedAt } } })
		return null
	}
}
```
onde `startedAt = new Date()` é capturado no início de `deliver` (assim só se apagam as
reivindicações feitas agora). Ajuste `runEmailJobs` para ignorar `null` em `results`.
Se o envio FALHAR, apague as reivindicações desta tentativa
(`deleteMany({ where: { userId, key: { in: email.keys } } })`) para permitir o reenvio depois.

**Verificar**: `bun run typecheck` → exit 0.

### Passo 3: Separar "envio falhou" de "registro falhou"

Reestruture `deliver` para:
```ts
try { await sendEmail(...) }
catch (error) { /* apaga claims, grava emailLog com error, devolve { error } — como hoje */ }
// Enviou: daqui para frente nada pode virar "falha de envio"
try {
	await prisma.emailLog.create({ data: { userId, kind, subject, keys: email.keys } })
} catch (error) {
	console.error('[e-mail] enviado, mas não registrado', error)
}
return { kind, subject, error: null }
```
Com o passo 2, mesmo sem o `emailLog` as chaves ficam reivindicadas e o e-mail não repete.

**Verificar**: `bun run typecheck` → exit 0.

### Passo 4: Resumo só quando todas as contas ativas cobrem o período

Em `reports.ts`, troque `importedUntil` por:
```ts
/**
 * Até onde TODAS as contas ativas estão importadas: o menor "último dia" entre as contas com
 * transação nos últimos 60 dias (conta parada há mais tempo não segura o resumo)
 */
export async function importedUntil(userId: string) {
	const rows = await prisma.transaction.groupBy({
		by: ['accountId'],
		where: { account: { userId } },
		_max: { date: true },
	})
	const dates = rows.map((row) => row._max.date).filter((date): date is Date => date !== null)
	if (dates.length === 0) return null
	const newest = Math.max(...dates.map((date) => date.getTime()))
	const active = dates.filter((date) => newest - date.getTime() <= 60 * 24 * 60 * 60 * 1000)
	return new Date(Math.min(...active.map((date) => date.getTime())))
}
```

**Verificar**: `bun run typecheck` → exit 0; `bun run check` → exit 0.

## Plano de testes

As funções dependem do banco; não há infraestrutura de teste com banco no projeto. Em vez de
testes automáticos, descreva na mensagem de conclusão como o dono verifica: "Verificar agora"
duas vezes seguidas na tela de Notificações → só um e-mail por aviso; a tabela
`email_key_claim` recebe as chaves enviadas.

## Critérios de pronto

- [ ] `bun run check` sai 0
- [ ] Migração `*_email_key_claim` criada
- [ ] `deliver` não grava `emailLog` com `error` quando `sendEmail` teve sucesso (leia o código)
- [ ] `importedUntil` usa `groupBy` por conta
- [ ] Linha do plano 010 em `plans/README.md` atualizada

## Condições de PARADA

- `PendingEmail.keys` puder ser vazio para e-mails que mesmo assim não podem repetir (então a
  reivindicação não protege) — reporte quais.
- A migração falhar ou o modelo `User` não estiver em `prisma/schema/auth.prisma`.
- `deliver` for chamado em outro lugar que dependa do retorno nunca ser `null` (confira com
  `grep -rn "deliver(" src`; a rota de teste de e-mail pode chamá-lo).

## Notas de manutenção

- Toda chave nova de aviso (`"tipo:..."`) passa automaticamente pela reivindicação.
- O critério "conta ativa = transação nos últimos 60 dias" é heurístico; se o dono parar de
  usar uma conta, ela deixa de segurar os resumos depois de 60 dias.
