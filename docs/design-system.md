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

- **Icon set oficial: Lucide (`lucide-react`, stroke 1.5–2).** Adotado como padrão do projeto (CLAUDE.md, regra 12; primeiro uso em CAD-08). Novos componentes usam ícones do Lucide; os **quadrados arredondados 16px** do protótipo são placeholders legados a substituir conforme as telas forem tocadas.
- **Logo:** não fornecido. Marca provisória = tile arredondado com "A". Cada arena exibe seu próprio nome + tile no topo da sidebar.
- Avatares: círculo `#e4e2db` com iniciais 11/600.
- **Avatar hero / perfil (aprovado — CAD-08):** variante maior para cabeçalho de perfil — 56px, fundo `var(--accent-tint)`, texto `var(--accent)`, iniciais em tamanho maior que o avatar padrão.

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

---

## INTEGRAÇÃO COM TAILWIND CSS E SHADCN/UI

> **Decisão de arquitetura (2026-07-19):** O design system usa tokens CSS customizados
> integrados ao Tailwind CSS via `tailwind.config.ts` e ao Shadcn/ui via tema sobrescrito.
> Os três coexistem e são complementares.

### Como funciona

```
docs/design-system.md  ← fonte de verdade (este arquivo)
        ↓ implementado em
apps/web/globals.css   ← define os --tokens CSS na :root
        ↓ mapeado em
tailwind.config.ts     ← extend: colors, borderRadius, spacing
        ↓ disponível como
classes Tailwind        ← bg-app, text-accent, rounded-card, etc.
        ↓ aplicado sobre
Shadcn/ui              ← componentes base sobrescritos com tokens do Arena SaaS
```

### Regras de implementação
1. **Tokens CSS primeiro:** declare as variáveis em `globals.css` antes de usar em Tailwind ou Shadcn.
2. **Tailwind extend, não override:** sempre usar `theme.extend` no `tailwind.config.ts`, nunca sobrescrever o tema completo.
3. **Shadcn customizado:** ao adicionar componentes Shadcn, ajustar as classes `cn()` para usar os tokens do Arena SaaS em vez das cores padrão do shadcn (ex: `bg-primary` → `bg-accent`).
4. **Ordem de prioridade de composição:**
   - Primeiro buscar em **Shadcn/ui** (componente base gratuito).
   - Depois em **`packages/ui`** (extensões específicas do Arena SaaS).
   - Só criar do zero se não existir em nenhum dos dois.
5. **Classes Tailwind utilitárias para layout:** spacing, flex, grid, padding — usar Tailwind diretamente.
6. **Tokens para identidade visual:** cores, raios, tipografia, sombras — usar as variáveis CSS via `var(--token)` ou as classes mapeadas no Tailwind.

### Mapeamento de classes Tailwind dos tokens

| Token CSS | Classe Tailwind sugerida |
|---|---|
| `--bg-app` | `bg-app` |
| `--bg-sunken` | `bg-sunken` |
| `--accent` | `bg-accent` / `text-accent` |
| `--accent-hover` | `hover:bg-accent-hover` |
| `--text-1` | `text-primary` |
| `--text-2` | `text-secondary` |
| `--text-3` | `text-muted` |
| `--border` | `border-default` |
| `--radius-card` | `rounded-card` |
| `--radius-button` | `rounded-button` |
| `--radius-modal` | `rounded-modal` |
| `--sidebar-bg` | `bg-sidebar` |
