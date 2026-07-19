# Arena SaaS — Design System

Sistema de design para o **Arena SaaS**: plataforma multi-tenant de gestão de arenas esportivas (padel/beach tennis) cobrindo PDV e comandas, locação de quadras, cadastros, filiação (clube de benefícios), pontos/cashback, CRM, WhatsApp, publicidade e relatórios.

---

## FUNDAMENTOS DE CONTEÚDO

- **Idioma:** português (Brasil). Vocabulário do domínio: comanda, lançamento, sangria/suprimento, caixa, saldo devedor, filiado, opt-in, quadra, locação, tenant/arena.
- **Tom:** operacional, direto e sem floreio. Frases curtas; a interface fala com o operador ("Informe os valores físicos contados…"), nunca com marketing.
- **Caixa:** sentence case em tudo; CAIXA ALTA apenas em overlines (seções do menu: `OPERAÇÃO`, cabeçalhos de tabela: `NOME · WHATSAPP`).
- **Pessoa:** imperativo neutro ("Buscar cliente…", "Adicionar à cobrança"). Nada de "nós"/"você" gratuito.
- **Microcopy de regra de negócio:** cada tela crítica ecoa a regra em 11px cinza (`--text-3`) — ex.: "Cada lançamento grava o preço do momento (snapshot imutável)". Isso é assinatura do produto: a UI ensina a regra.
- **Números:** dinheiro sempre `R$ 0.000,00` (centavos internamente); placeholders genéricos usam zeros (`R$ 00,00`, `Cliente A`, `Produto X`, `00/00/0000`).
- **Emoji:** nunca. Setas unicode (▲ ▶ ◀ →) e × são permitidas como glifos utilitários.
- **Toasts:** confirmam a ação E citam a consequência ("Comanda fechada · 128 pontos creditados a Cliente A").

---

## FUNDAMENTOS VISUAIS

- **Cor de fundo:** neutros quentes — app `--bg-app #f6f5f2`, superfícies brancas, sunken `#fafaf9`. Sem gradientes, sem texturas, sem imagens de fundo.
- **Acento único:** azul `oklch(0.48 0.13 255)` (hover `0.42`, versão clara p/ sidebar `0.55 0.14`). Tints em `0.95/0.98` p/ seleção. Croma constante 0.13 — novas cores de acento devem variar só o hue.
- **Sidebar escura:** navy `#171d29` — o único bloco escuro da UI. Item ativo é pill `--accent-bright`; hover `#222b3c`.
- **Semânticas:** sucesso verde `oklch(0.5 0.13 150)`, alerta dourado `#c9a13c`, perigo `#b0433a` — sempre em par "cor forte + fundo tint + borda tint" para banners.
- **Gráficos:** escala mono-hue do azul (`--chart-1..5`), nunca multicolorida.
- **Tipografia:** só **Instrument Sans** (400–700). Números grandes 30/700 com tracking -0.01em. Nada de serifas ou monospace na UI.
- **Cards:** branco, borda 1px `--border`, raio 10px (12 no PDV touch), sombra quase nula `0 1px 3px rgba(0,0,0,.04)`. Card selecionado: borda 2px do acento.
- **Raios:** 7 controles · 8 inputs · 9 botões · 10 cards · 12 cards touch · 14 modais · 20 pills · 50% avatares.
- **Sombras:** só três — card (sutil), modal `0 20px 50px .25`, toast `0 8px 24px .3`.
- **Bordas:** divisórias `--border-soft`; tracejada `--border-dashed` = ação "criar novo" ou slot livre na grade.
- **Hover:** botões escurecem (accent→accent-hover); cards ganham borda mais escura; sidebar ganha `--sidebar-hover`; células da grade `filter:brightness(.97)`. Sem transform/escala.
- **Animação:** mínima — `transition .18s ease` em navegação/hover; toast entra com fade+slide 10px. Sem bounces.
- **Transparência/blur:** só o overlay de modal `rgba(15,20,30,.45)`. Sem glassmorphism.
- **Status:** ponto 9px colorido + rótulo 13.5/600 (Conectado/Fechado…).
- **Layout:** sidebar fixa (216px ↔ 64px recolhida), header de tela branco com borda inferior, conteúdo em grid `gap:14px`, padding de tela 20×22. PDV: alvos de toque ≥44px, painel lateral de comanda 300–320px.
- **Densidade:** tabelas 12.5px com linhas de 12px de padding; KPIs em grid de 4.

---

## ICONOGRAFIA

- **Não há icon font nem set de SVGs no projeto.** O protótipo usa **quadrados arredondados 16px** como placeholders de ícone — manter até um set ser escolhido.
- Recomendação futura: **Lucide** via CDN (stroke 1.5–2). Registrar a troca neste arquivo quando acontecer.
- **Logo:** não fornecido. Marca provisória = tile arredondado com "A". Cada arena exibe seu próprio nome + tile no topo da sidebar.
- Avatares: círculo `#e4e2db` com iniciais 11/600.

---

## COMPONENTES

Extraídos exclusivamente do protótipo aprovado:

### Core
- **Button:** primary / dark / secondary / ghost / danger
- **Input:** raio 8px; label 12/600 acima; helper 11px cinza abaixo
- **Badge:** 8 tons incluindo Ouro/Prata/Bronze para filiações
- **Pill:** raio 20px; status ativo/inativo

### Data
- **StatCard (KPI):** número 30/700 + rótulo 12/400; grid de 4 no dashboard
- **DataTable:** 12.5px, header CAIXA ALTA, linha 12px padding, zebra sutil

### Feedback
- **Modal:** raio 14px, overlay `rgba(15,20,30,.45)`, sombra `0 20px 50px .25`
- **Toast:** confirma ação + consequência; fade+slide 10px; sombra `0 8px 24px .3`

### Navigation
- **SidebarItem:** pill ativo com `--accent-bright`; hover `#222b3c`; ícone placeholder 16px
- **SidebarSection:** overline CAIXA ALTA 10/700 letra-espaçamento 0.08em

---

## PADRÕES DE TELA (RECEITAS)

- **Header de tela:** título 16/600 + ações à direita (1 botão primary no máximo) sobre branco com borda inferior.
- **Grade de quadras:** grid horário×quadra. Livre = branco borda tracejada. Ocupado = accent sólido. Reservado = dourado.
- **Banner de devedor:** fundo `--danger-bg`, borda `--danger-border`, título 12/700 vermelho + botão danger.
- **Fechamento de caixa:** divisão por meio de pagamento em grid 2×2, restante em vermelho→verde, botão primary desabilitado = `#c6c4bb`.

---

## TOKENS CSS (referência rápida)

```css
/* Cores */
--bg-app: #f6f5f2;
--bg-sunken: #fafaf9;
--accent: oklch(0.48 0.13 255);
--accent-hover: oklch(0.42 0.13 255);
--accent-bright: oklch(0.55 0.14 255);
--accent-tint: oklch(0.95 0.13 255);
--sidebar-bg: #171d29;
--sidebar-hover: #222b3c;
--success: oklch(0.5 0.13 150);
--warning: #c9a13c;
--danger: #b0433a;
--text-1: #1a1916;  /* principal */
--text-2: #4a4845;  /* secundário */
--text-3: #9a9895;  /* terciário / microcopy */
--border: #e8e6e0;
--border-soft: #f0ede7;
--border-dashed: #d4d1cb;

/* Raios */
--radius-control: 7px;
--radius-input: 8px;
--radius-button: 9px;
--radius-card: 10px;
--radius-card-touch: 12px;
--radius-modal: 14px;
--radius-pill: 20px;
```
