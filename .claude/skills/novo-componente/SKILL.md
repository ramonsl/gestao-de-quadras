---
name: novo-componente
description: Guia de criacao de componentes de UI para o Arena SaaS seguindo o design system aprovado. Use ANTES de escrever qualquer JSX/TSX, CSS ou Tailwind de UI nova - garante consistencia visual e de microcopy.
tools: Read, Grep, Glob
---

# Novo componente de UI — Arena SaaS

Antes de escrever qualquer linha de JSX, CSS ou Tailwind, siga este checklist.
A fonte de verdade do design é `docs/design-system.md`. Leia-a antes de propor tokens ou componentes.

## 1. Busca obrigatória (não duplicar)
1. `grep -r "ComponentName" packages/ui src` — o componente existe no projeto?
2. Verificar se o componente existe em **Shadcn/ui** (`pnpm dlx shadcn@latest add <componente>`).
3. Se já existe: use, estenda por composição. Só crie um novo se não houver equivalente.

## 2. Tokens obrigatórios
Use **sempre** as variáveis CSS do design system, nunca valores literais:
- Cores: `--bg-app`, `--accent`, `--accent-hover`, `--text-1/2/3`, `--border`, `--danger`, `--warning`, `--success`
- Raios: `--radius-card` (10px), `--radius-button` (9px), `--radius-input` (8px), `--radius-modal` (14px), `--radius-pill` (20px)
- Sidebar: `--sidebar-bg` (#171d29), `--sidebar-hover` (#222b3c)
- **Nunca** usar `border-radius: 8px` literal, use `var(--radius-input)`

## 3. Tipografia
- **Fonte única:** Instrument Sans (400–700). Nada de serifas ou monospace na UI.
- Números KPI: 30px/700 tracking -0.01em
- Microcopy de regra de negócio: 11px, `--text-3`, em toda tela crítica
- Overlines de seção: CAIXA ALTA, 10px, letter-spacing 0.08em

## 4. Conteúdo e microcopy
- **Idioma:** português (BR), tom operacional. Sem marketing, sem "você/nós" gratuito.
- **Emoji:** proibido. Usar setas unicode (▲ ▶ ◀ →) e ×.
- **Dinheiro:** sempre `R$ 0.000,00`. Placeholder: `R$ 00,00`.
- **Toast:** confirma a ação E a consequência. Ex.: "Comanda fechada · 128 pontos creditados".
- Cada tela crítica deve ter o microcopy da regra de negócio correspondente (ver `docs/design-system.md`).

## 5. Comportamento visual
- **Hover:** botões escurecem; cards ganham borda mais escura; sem transform/escala.
- **Animação:** `transition .18s ease` apenas. Sem bounces, sem glassmorphism.
- **Sombras:** só as três definidas no design system (card, modal, toast).
- **PDV:** alvos de toque ≥ 44px; raio de card = 12px (touch).

## 6. Componentes novos — onde criar
- Componente genérico reutilizável → `packages/ui/src/`
- Componente específico de uma tela → dentro da pasta da própria rota em `apps/web/`
- **Nunca** criar componente genérico diretamente em `apps/web/components/`

## 7. Ícones
- Usar quadrados arredondados 16px como placeholder até Lucide ser adotado formalmente.
- Quando Lucide for adotado, registrar no `docs/design-system.md`.

## Saída esperada
Código TSX + CSS com:
- Tokens CSS corretos (sem literais)
- Microcopy em pt-BR operacional
- Props tipadas em TypeScript (zero `any`)
- Sem lógica de negócio inline (lógica vai em `packages/core`)
