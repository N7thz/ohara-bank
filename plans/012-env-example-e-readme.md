# Plano 012: `.env.example` documentado e README com instalação e recuperação de acesso

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de verificação
> e confirme o resultado esperado antes do próximo passo. Se acontecer algo da seção
> "Condições de PARADA", pare e reporte — não improvise. Ao terminar, atualize a linha deste
> plano em `plans/README.md`.
>
> **Checagem de deriva (rode primeiro)**: `git diff --stat 84bba39 -- README.md .gitignore package.json prisma.config.ts`
>
> **Regra absoluta**: NÃO abra, leia ou copie o arquivo `.env` (tem segredos reais). Use só
> nomes de variáveis e valores de exemplo inventados.

## Status

- **Prioridade**: P2
- **Esforço**: S
- **Risco**: LOW
- **Depende de**: nenhum (melhor depois do plano 001, para documentar `bun run check`)
- **Categoria**: docs
- **Planejado em**: commit `84bba39` (+ árvore de trabalho não commitada), 2026-11-14

## Por que isso importa

O `README.md` é o texto padrão do create-next-app. Não há `.env.example`. O app é de um
usuário só e sem senha: se a passkey se perder, a recuperação é o comando
`bun run auth:reset-totp`, que não está escrito em lugar nenhum. Reinstalar o projeto em outra
máquina hoje exige ler o código para descobrir as variáveis de ambiente — e uma delas,
`BETTER_AUTH_SECRET`, nem aparece no código (o better-auth a lê sozinho). Esquecê-la ou errar
`ADMIN_EMAIL` tranca o dono fora do app.

## Estado atual

- Variáveis lidas no código (contagem de ocorrências):
  - `DATABASE_URL` — `src/lib/prisma.ts` (conexão do app)
  - `DIRECT_URL` — `prisma.config.ts` (`datasource.url: env('DIRECT_URL')`, usada pelas migrações)
  - `BETTER_AUTH_URL` — `src/lib/auth/index.ts` (padrão `http://localhost:3000`; define o domínio
    da passkey) e `src/emails/components/email-layout.tsx` (links nos e-mails)
  - `BETTER_AUTH_SECRET` — lida implicitamente pelo better-auth (criptografa o segredo do TOTP e
    assina sessões). Gerar com `openssl rand -base64 32`.
  - `ADMIN_EMAIL` — `prisma/seed.ts`, `src/lib/auth/totp-sign-in.ts`,
    `src/app/api/security/totp/route.ts`, `src/app/api/security/totp/login-status/route.ts`
    (único usuário; login por código só vale para ele)
  - `ADMIN_NAME` — `prisma/seed.ts` (padrão `'Admin'`)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — `src/lib/email/transport.ts`
    (e-mails; opcionais — sem elas, os e-mails ficam desligados)
- `.gitignore` tem `.env*` (que também ignoraria um `.env.example`) e `/extratos/`.
- Scripts relevantes em `package.json`: `dev`, `build`, `db:migrate`, `db:seed`, `db:generate`,
  `auth:reset-totp` (`bun prisma/seed.ts --reset-totp`), `email` (pré-visualização dos e-mails
  na porta 3001), e — depois do plano 001 — `check`.
- `prisma/seed.ts`: cria o usuário `ADMIN_EMAIL` sem senha e imprime um QR code do autenticador;
  com `--reset-totp`, gera um autenticador novo (recuperação).
- Fatos de funcionamento para o README:
  - Login: passkey (cadastrada em Dashboard → Segurança) ou, de reserva, o código de 6 dígitos
    do autenticador.
  - Importação aceita: Nubank (CSV e OFX da conta e do cartão), Itaú (PDF do extrato da conta e
    PDF da fatura do cartão — a fatura tem senha: os 5 primeiros dígitos do CPF), CSV/OFX de
    outros bancos (pede banco e tipo), e holerite em PDF.
  - E-mails saem por um agendador dentro do servidor (`src/lib/email/scheduler.ts`,
    `src/instrumentation.ts`): só enviam enquanto o app está rodando, a cada 15 min.
  - Esquema do banco dividido por domínio em `prisma/schema/*.prisma` (nunca um arquivo único).
  - Design: `DESIGN.md`; regras para agentes: `AGENTS.md`/`CLAUDE.md`.
- O projeto se chama "Ohara Bank" (`appName` em `src/lib/auth/index.ts`); interface em pt-BR.

## Escopo

**Dentro do escopo**: `.env.example` (criar), `.gitignore` (só uma linha), `README.md` (reescrever).

**Fora do escopo**: `.env` (não abra), qualquer código, validação de env em tempo de execução
(adiada).

## Fluxo de git

Não commite, não faça stash nem checkout. Se instruído: `docs: ...` em pt-BR, só estes 3 arquivos.

## Passos

### Passo 1: `.env.example`

Crie com valores de EXEMPLO e um comentário por variável (obrigatória/opcional, para que serve):
```dotenv
# Banco (PostgreSQL). O app usa DATABASE_URL; as migrações usam DIRECT_URL (sem pooler)
DATABASE_URL="postgresql://usuario:senha@localhost:5432/ohara"
DIRECT_URL="postgresql://usuario:senha@localhost:5432/ohara"

# Autenticação (obrigatórias)
BETTER_AUTH_SECRET="gere com: openssl rand -base64 32"
BETTER_AUTH_URL="http://localhost:3000"
ADMIN_EMAIL="voce@exemplo.com"
ADMIN_NAME="Seu nome"

# E-mails (opcionais: sem elas os e-mails ficam desligados)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER="voce@exemplo.com"
SMTP_PASS="senha de app do Gmail"
```
Em `.gitignore`, logo depois de `.env*`, acrescente `!.env.example`.

**Verificar**: `git check-ignore .env.example` → nenhuma saída (exit 1); `git check-ignore .env` → imprime `.env`.

### Passo 2: README em pt-BR

Substitua todo o `README.md` por seções curtas:
1. **O que é** (2 linhas: finanças pessoais de um usuário, importa extratos/faturas/holerites).
2. **Requisitos**: bun, PostgreSQL.
3. **Instalação**: `bun install` → copiar `.env.example` para `.env` e preencher →
   `bun run db:migrate` → `bun run db:seed` (escaneie o QR code no app autenticador) →
   `bun run dev` → entrar com o código → cadastrar uma passkey em Segurança.
4. **Recuperar acesso**: perdeu a passkey e o autenticador? `bun run auth:reset-totp` no
   servidor gera um novo QR code.
5. **Importação**: formatos aceitos (lista do "Estado atual"), incluindo a senha da fatura Itaú.
6. **E-mails**: como funcionam (só com o app rodando), variáveis SMTP, `bun run email` para
   pré-visualizar.
7. **Desenvolvimento**: `bun run check` (typecheck + lint + testes), schema em
   `prisma/schema/`, mapa rápido de pastas (`src/lib/statements`, `src/lib/payslips`,
   `src/lib/debts`, `src/lib/recurring.ts`, `src/lib/email`, API em `src/app/api/finance`,
   hooks em `src/hooks`), links para `DESIGN.md` e `AGENTS.md`.
8. **Privacidade**: a pasta `extratos/` e o `.env` ficam fora do git; nunca commitar dados reais.

**Verificar**: `grep -c "auth:reset-totp" README.md` → ≥ 1; `grep -c "create-next-app" README.md` → 0.

## Critérios de pronto

- [ ] `.env.example` existe, não é ignorado pelo git e cita as 10 variáveis
- [ ] Nenhum valor real em `.env.example` (todos são exemplos óbvios)
- [ ] README cobre instalação, recuperação de acesso, importação, e-mails e desenvolvimento
- [ ] Linha do plano 012 em `plans/README.md` atualizada

## Condições de PARADA

- Você precisar do valor real de alguma variável para escrever o exemplo (não precisa — use exemplos).
- Encontrar uma variável de ambiente usada no código que não está na lista acima
  (`grep -rhno "process.env\.[A-Z_]*" src prisma prisma.config.ts`) — acrescente-a e mencione no relatório.

## Notas de manutenção

- Toda variável nova de ambiente entra no `.env.example` no mesmo commit.
- Adiado: validar as variáveis na subida do servidor com zod (falhar cedo com mensagem clara).
