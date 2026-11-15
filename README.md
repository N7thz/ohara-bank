# Ohara Bank

Finanças pessoais para um único usuário: importa extratos, faturas de cartão e holerites, classifica as
transações com tags e acompanha dívidas, metas de economia e resumos por período. Interface em pt-BR.

## Requisitos

- [bun](https://bun.sh)
- PostgreSQL

## Instalação

1. `bun install`
2. Copie `.env.example` para `.env` e preencha (`BETTER_AUTH_SECRET` com `openssl rand -base64 32`;
   `ADMIN_EMAIL` é o e-mail do único usuário — errar esse valor tranca você fora do app).
3. `bun run db:migrate`
4. `bun run db:seed` — cria o usuário e imprime um QR code: escaneie no app autenticador.
5. `bun run dev` e entre com o código de 6 dígitos do autenticador.
6. Em Dashboard → Segurança, cadastre uma passkey (passa a ser o login principal; o código fica de reserva).

## Recuperar acesso

Perdeu a passkey e o autenticador? No servidor, rode `bun run auth:reset-totp`: ele gera um novo
autenticador e imprime um novo QR code.

## Importação

- **Nubank**: CSV e OFX da conta e do cartão.
- **Itaú**: PDF do extrato da conta e PDF da fatura do cartão (a fatura tem senha: os 5 primeiros dígitos do CPF).
- **Outros bancos**: CSV/OFX (o app pede o banco e o tipo da conta).
- **Holerite**: PDF.

## E-mails

Saem por um agendador dentro do servidor (`src/lib/email/scheduler.ts`, `src/instrumentation.ts`): só são
enviados enquanto o app está rodando, a cada 15 minutos. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e
`SMTP_PASS`; sem elas os e-mails ficam desligados. `bun run email` abre a pré-visualização na porta 3001.

## Desenvolvimento

- `bun run check` roda typecheck, lint e testes.
- O schema do Prisma fica dividido por domínio em `prisma/schema/*.prisma` (nunca um arquivo único).
- Mapa rápido: `src/lib/statements` (leitores de extrato), `src/lib/payslips`, `src/lib/debts`,
  `src/lib/recurring.ts`, `src/lib/goals.ts`, `src/lib/email`, API em `src/app/api/finance`, hooks em `src/hooks`.
- Design: [`DESIGN.md`](DESIGN.md). Regras para agentes: [`AGENTS.md`](AGENTS.md).

## Privacidade

A pasta `extratos/` e o arquivo `.env` ficam fora do git. Nunca commite dados reais.
