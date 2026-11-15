---
version: "alpha"
name: "Liquid Glass (app de finanças)"
description: "Vidro translúcido calmo sobre manchas iridescentes paradas, para um app pessoal de finanças: o número é o protagonista, a decoração fica atrás."
colors:
  primary: "#5B47E0"
  foreground: "#1A1A1A"
  muted-foreground: "#4A4A4A"
  background: "#F5F7FB"
  positive: "#13753A"
  negative: "#B91C1C"
  warning: "#8A5700"
typography:
  h1:
    fontFamily: System UI stack
    fontSize: clamp(1.75rem, 3vw, 2.25rem)
    fontWeight: 600
  h2:
    fontFamily: System UI stack
    fontSize: 1.5rem
    fontWeight: 600
  hero-number:
    fontFamily: System UI stack
    fontSize: clamp(2rem, 4vw, 3rem)
    fontWeight: 700
  body-md:
    fontFamily: System UI stack
    fontSize: 1rem
    fontWeight: 400
  body-sm:
    fontFamily: System UI stack
    fontSize: 0.875rem
    fontWeight: 400
  label:
    fontFamily: System UI stack
    fontSize: 0.75rem
    fontWeight: 500
---

## Overview

App pessoal de finanças (extratos, transações, dívidas, contas recorrentes). Modo de uso: **operar**. Quem abre quer responder "quanto entrou, quanto saiu, o que falta pagar" e agir. O Liquid Glass fica como atmosfera: vidro translúcido e manchas iridescentes atrás, nunca disputando atenção com o dado.

- Density: 6/10 (equilibrado, um pouco mais denso que o template original)
- Variance: 3/10 (padrões repetidos entre as páginas)
- Motion: 2/10 (entrada curta, nada contínuo)
- **Light/Dark:** os dois temas, cada um com tokens próprios (`src/app/globals.css`, `:root` e `.dark`)

## Colors

Tokens em `src/app/globals.css`; use sempre o utilitário do token, nunca a cor do Tailwind direto.

| Papel | Claro | Escuro | Uso |
|---|---|---|---|
| `primary` | #5B47E0 | #5B47E0 | ação principal, seleção, anel de foco (`--ring`) |
| `primary-text` | #5B47E0 | #A99DF5 | links e texto roxo (`.text-primary`) |
| `positive` | #13753A | #4ADE80 | entrada de dinheiro, saldo positivo, queda de gasto, "paga" |
| `negative` | #B91C1C | #F87171 | saída, saldo negativo, alta de gasto, erros de carregamento |
| `warning` | #8A5700 | #E8B546 | conta não achada no mês, orçamento perto do limite |
| `destructive` | #E5484D | #EF5B5F | fundo de botões destrutivos (texto branco) |
| `chart-1..5` | roxo, rosa, ciano, lilás, neutro | | séries sem significado de dinheiro |
| `tag-*` | seis cores | | cores das tags (o nome fica salvo no banco) |

Regras:
- `positive`/`negative`/`warning` passam de 4,5:1 sobre o card translúcido nos dois temas. Dinheiro nunca é só cor: vem com sinal (+/−) ou seta (▲/▼) e rótulo.
- O gráfico de entradas e saídas usa `positive`/`negative`, igual ao resto do app.
- Sem preto puro; texto em #1A1A1A.

## Typography

Pilha do sistema (`system-ui, -apple-system, "Segoe UI", Roboto…`); JetBrains Mono só para valores técnicos. Valores em `tabular-nums`.

- **H1 (título da página):** clamp(1.75rem, 3vw, 2.25rem), peso 600, `text-balance`. Título de app, não de landing page.
- **Número do hero:** clamp(2rem, 4vw, 3rem), peso 700. É o maior elemento da página, de propósito.
- **H2 (seção):** 1.5rem, peso 600.
- **Corpo:** 1rem/1.6; descrições em 0.875rem, máximo 72ch.
- **Rótulos e notas:** 0.75rem (`text-xs`) é o menor tamanho. Nada de `text-[0.7rem]`.
- Sem rótulo em caixa alta acima do título (eyebrow): o contexto da página (ex.: o período) vem logo abaixo do H1, em 0.875rem.

## Layout

- Conteúdo em até 1280px (`max-w-7xl`), 1.5rem nas laterais.
- **Vão entre seções:** clamp(2rem, 3vw, 3rem) (`.page-stack`, `.section-stack`). O dado precisa aparecer na primeira dobra.
- **Cabeçalho:** texto e filtros à esquerda, o número principal (`HeroMetric`) à direita; empilha abaixo de 768px.
- **Barras de filtro:** fixas no topo (`md:sticky`) só a partir de 768px; no celular viram grade de duas colunas e rolam com a página.
- **Sidebar:** dois grupos rotulados (Dinheiro, Conta); o item ativo vale para subpáginas.
- z-index: base (0) / barra fixa (10) / overlay e modal (componentes shadcn) / toast.

## Elevation & Depth

- **Fundo:** quatro manchas iridescentes desfocadas (`.liquid-bg`), **paradas**.
- **Desfoque (`backdrop-filter`):** só no que fica por cima do conteúdo: sidebar, barras fixas (`.glass-bar`), diálogos, sheets, menus, selects e tooltips. Cards não desfocam; são mais opacos (72% de branco no claro) para o texto não depender do fundo.
- **Cards:** reflexo branco no topo, sombra suave (0 2px 12px) e borda iridescente fixa a 25%. Card parado não reage ao hover.
- **Movimento:** entrada de 260ms (fade + 6px), cascata de 40ms com teto de 160ms; troca de página em 200ms. Nada em loop além do brilho do skeleton. `prefers-reduced-motion` zera tudo.

## Shapes

Raio base 12px (`--radius: 0.75rem`), escala `--radius-sm` a `--radius-4xl`.

## Components

- **Botão principal:** fundo `primary`, peso 600; hover escurece 8% com sombra curta.
- **Botão outline:** vidro com borda de 1.5px.
- **Foco:** anel sólido de 2px na cor `--ring`, afastado 2px, em botões, inputs, selects, toggles, switches, links e itens da sidebar.
- **Confirmação destrutiva:** `ConfirmDialog` (`src/components/confirm-dialog.tsx`): título com o verbo, as consequências escritas (o que some, o que fica, se dá para desfazer), foco inicial em Cancelar, botão com o verbo específico. Nunca `confirm()` do navegador. Onde der, "Desfazer" no toast.
- **Erro de carregamento:** `QueryError` (`src/components/query-error.tsx`): `role="alert"`, o que falhou e o botão "Tentar de novo".
- **Gráficos:** setas de período anterior e próximo no cabeçalho (teclado) e resumo em texto para leitor de tela; o gráfico em si é `aria-hidden`.
- **Skeletons:** brilho passando, no formato do conteúdo.
- **Estados vazios:** ícone, explicação e um botão para o próximo passo.

## Do's and Don'ts

- Ícones só do Lucide; sem emoji na interface.
- Cor de dinheiro sempre pelos tokens `positive`/`negative`, com sinal ou seta.
- Sem aberração cromática, sem escala no hover, sem manchas em movimento.
- Sem `h-screen`; use `min-h-[100dvh]`.
- Informação importante escrita na tela, não só em `title`/tooltip.
- Não editar `src/components/ui/*` (shadcn); o estilo do vidro vem de `globals.css` por `data-slot`.
