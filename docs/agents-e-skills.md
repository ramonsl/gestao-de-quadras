# Agentes e Skills — Arena SaaS

Documentação dos agentes de IA e skills (comandos de barra) que automatizam o
ciclo de desenvolvimento spec-driven do projeto. Todos vivem em `.claude/agents/`
e `.claude/skills/` e são acionados pelo Claude Code.

---

## Por que esse modelo existe

O Arena SaaS tem regras invioláveis (isolamento de tenant, segurança, design
system, zero `any`) que precisam ser verificadas em **todo** Pull Request. Em vez
de checklists manuais que se perdem, criamos agentes especializados que rodam em
paralelo após cada implementação e retornam uma lista de achados classificados —
antes que qualquer código entre na branch `dev`.

O fluxo completo de uma User Story é:

```
/nova-us <ID>
    │
    ├─ planner         → plano técnico (migrations, contratos, UI)
    ├─ implementação   → código no branch feat/<ID>
    ├─ test-runner     → Vitest + Playwright, todos os AC
    ├─ tenant-guard    → isolamento multi-tenant
    ├─ security-guard  → autenticação, XSS, injeção, segredos
    ├─ ui-guard        → design system, tokens, acessibilidade
    └─ commit + PR → base dev
```

---

## Agentes (`.claude/agents/`)

Cada agente é um especialista narrow: recebe um contexto restrito, usa apenas as
ferramentas que precisa e devolve um relatório estruturado. Eles rodam em paralelo
sempre que possível, reduzindo o tempo de revisão.

### `planner`

**Acionamento:** `/nova-us <ID>` ou manualmente antes de qualquer implementação.

Arquiteto do projeto. Lê a US e todos os ACs em `docs/spec/`, explora o código
existente para reaproveitar padrões e produz um plano técnico enxuto com:

| Seção | Conteúdo |
|---|---|
| Escopo | O que entra e o que explicitamente **não** entra |
| Migrations | Tabelas/colunas novas com tipos, FKs, índices compostos com `tenant_id` |
| Contratos | Assinaturas das funções em `packages/core` (entrada/saída Zod) |
| Rotas / UI | Páginas, server actions ou route handlers afetados em `apps/web` |
| Jobs | Filas e workers afetados em `apps/worker` (quando houver) |
| Testes | Lista dos casos unitários + cenário Playwright por AC |
| Riscos | Isolamento, permissões, concorrência, idempotência |

> Ferramentas: somente leitura (Read, Grep, Glob). Não escreve código de produção.

---

### `test-runner`

**Acionamento:** após a implementação, antes do commit.

QA do projeto. Derivando os cenários diretamente dos critérios de aceite:

1. **Vitest** — testa funções de serviço puras em `packages/core` com repositórios
   fake. Cobre caminho feliz, erros de negócio e limites (saldo insuficiente,
   comanda fechada, horário ocupado, opt-out de WhatsApp).
2. **Playwright** — um spec por US (`apps/web/e2e/<us-id>.spec.ts`) com fluxo
   completo de usuário autenticado.
3. **Isolamento** — prova que o tenant B não enxerga dados do tenant A.

Corre a suite (`pnpm test` + `pnpm e2e`) e corrige falhas de teste. Se o que
quebrou for comportamento divergente da spec, **não conserta o teste** — reporta
a divergência.

> Ferramentas: todas (Read, Write, Bash, Edit…).

---

### `tenant-guard`

**Acionamento:** após qualquer implementação, antes do commit.

Revisor de segurança multi-tenant. Analisa o diff contra o checklist abaixo e
classifica cada achado como BLOQUEANTE / ATENÇÃO / OK:

1. **Isolamento row-level** — toda query de arena tem `WHERE tenant_id = ${ctx.tenantId}`? INSERT grava `tenant_id` do contexto (nunca do input)? IDOR via `id` de outro tenant?
2. **Permissões** — toda rota/action nova valida sessão + role? Ações sensíveis exigem `admin`?
3. **Auditoria** — ações sensíveis gravam em `audit_logs`?
4. **LGPD** — dados pessoais novos têm base legal? WhatsApp respeita opt-in?
5. **Dinheiro e pontos** — valores em centavos (`integer`)? Operações idempotentes?
6. **Baileys** — nenhum import fora de `packages/messaging`? Envio sempre via fila?
7. **Segredos** — nenhuma credencial hardcoded?
8. **Zero `any`** — nenhum tipo `any` explícito ou `@ts-ignore` sem justificativa?
9. **Duplicação** — componente criado que já existe em `packages/ui` / Shadcn?
10. **Boy Scout** — o diff introduziu erros de lint que não existiam antes?

Qualquer BLOQUEANTE = revisão **REPROVADA**. Não edita código.

> Ferramentas: somente leitura (Read, Grep, Glob, Bash).

---

### `security-guard`

**Acionamento:** após implementar qualquer rota, server action, webhook ou endpoint público.

Complementar ao `tenant-guard` (que foca em isolamento de dados). Foca na
superfície de ataque de rotas e APIs:

| Item | O que verifica |
|---|---|
| Autenticação e sessão | `TenantContext` montado; `tenantId`, `userId`, `role`, `modulesAllowed` presentes |
| Autorização granular | `role` verificado antes de qualquer lógica; matriz em `permissions.ts` atualizada |
| Validação de input | Todo input parseado com Zod antes de qualquer lógica; schemas em `packages/core` |
| Injeção e XSS | Sem SQL raw com interpolação; sem `dangerouslySetInnerHTML` com input de usuário |
| Webhooks | Assinatura validada antes do processamento; idempotência por ID de evento |
| Rate limiting | Endpoints de auth e WhatsApp protegidos |
| Headers de segurança | CSP, X-Frame-Options, nosniff, Referrer-Policy |
| Exposição de erros | Sem stack trace na resposta ao cliente; env vars sensíveis nunca em `NEXT_PUBLIC_*` |
| Dependências | Pacotes novos auditados com `pnpm audit` |

Qualquer BLOQUEANTE = revisão **REPROVADA**. Não edita código.

> Ferramentas: somente leitura (Read, Grep, Glob, Bash).

---

### `ui-guard`

**Acionamento:** após implementar qualquer tela, componente JSX/TSX ou CSS.

Revisor de UI que audita o diff contra `docs/design-system.md`:

| Item | Regra |
|---|---|
| Tokens CSS | Sem valores literais de cor fora dos tokens `--*`; sem `border-radius` literal |
| Tipografia | Exclusivamente Instrument Sans; nenhuma serifa ou monospace na UI |
| Conteúdo | Sem emoji em UI do sistema (botões, labels, toasts, menus); sem inglês na UI |
| Reutilização | Sem duplicar componentes de `packages/ui` ou Shadcn |
| Comportamento | Sem `transform: scale()` ou bounce; sem glassmorphism |
| PDV | Alvos de toque ≥ 44px |
| Ícones | Somente Lucide (registrado no design system) |

Qualquer BLOQUEANTE = revisão **REPROVADA**. Não edita código.

> Ferramentas: somente leitura (Read, Grep, Glob, Bash).

---

### `spec-keeper`

**Acionamento:** quando uma decisão técnica ou de negócio altera requisitos, ou quando código e spec divergem.

Mantém a especificação em `docs/spec/` viva e sincronizada com o que foi
realmente implementado:

1. Identifica o que mudou (decisão de negócio, AC ajustado, comportamento diferente do especificado).
2. Atualiza o arquivo da US afetada. Nunca apaga AC — marca como alterado com `> Decisão (AAAA-MM-DD): …`.
3. Registra decisões de arquitetura na seção "Decisões registradas" da spec e, se for regra inviolável, no `CLAUDE.md`.
4. Cria US novas (ID sequencial, formato "Como [persona], quero [capacidade], para [benefício]") com ACs verificáveis.
5. Adiciona ou atualiza o `> ### Roteiro de Teste Manual (QA)` ao final de cada US nova/alterada.

> Ferramentas: Read, Grep, Glob, Edit, Write.

---

## Skills — comandos de barra

Skills são scripts de procedimento invocados com `/nome-da-skill` no Claude Code.
Eles orquestram agentes, impõem ordem e garantem que nenhuma etapa seja pulada.

### `/nova-us <ID>`

O ciclo completo de uma User Story. Nunca pule etapas.

```
1. Contexto  → lê spec local + issue do GitHub; alinha divergências
2. Plano     → aciona o agente planner; apresenta resumo ao usuário
3. Branch    → git checkout -b feat/<ID>-nome-da-feature a partir de dev
4. Código    → migrations → packages/core → apps/web → apps/worker
5. Testes    → aciona test-runner (Vitest + Playwright)
6. Reviews   → tenant-guard + security-guard + ui-guard em paralelo
7. Fechamento→ commit + push + gh pr create --base dev
```

Uso: `/nova-us PDV-12` ou `"implementa a CAD-07"`.

---

### `/migration`

Cria e aplica migrations Postgres no modelo row-level (`tenant_id`).

Checklist embutido:
- Tabela de arena com `tenant_id NOT NULL REFERENCES tenants(id)`
- Índices/uniques compostos com `tenant_id`
- Tabela adicionada a `TENANT_SCOPED_TABLES` em `schema.ts`
- Colunas monetárias como `integer` (centavos, nunca float)
- Colunas de dados pessoais anotadas (LGPD)

Processo: edita `schema.ts` → `pnpm db:generate` → revisa SQL → `pnpm db:migrate`.

---

### `/novo-componente`

Guia de criação de componentes de UI. Deve ser consultado **antes** de escrever
qualquer JSX, CSS ou Tailwind.

Garante:
- Busca prévia em `packages/ui` e Shadcn antes de criar algo novo
- Tokens CSS obrigatórios (sem literais de cor ou radius)
- Tipografia exclusivamente Instrument Sans
- Microcopy em pt-BR operacional, sem emoji na UI do sistema
- Componentes genéricos em `packages/ui`; específicos de rota dentro da própria pasta

---

### `/novo-endpoint`

Scaffolding de rota / server action com as quatro camadas obrigatórias:

1. **Sessão + tenant** — `getArenaContext()` monta o `TenantContext`; sem sessão → 401
2. **Permissão** — role validado contra `permissions.ts` (nunca inline)
3. **Validação** — input parseado com Zod antes de qualquer lógica
4. **Serviço** — rota só orquestra; regra de negócio em `packages/core`

Decisão server action × route handler:
- Mutations do painel/PDV → server action
- Webhooks, página pública, integrações → route handler

---

### `/release-check`

Verificação completa antes de merge para `main` ou deploy.

```
1. pnpm lint && pnpm typecheck && pnpm test && pnpm e2e
2. Cobertura da spec — cada US da fase tem spec Playwright? Todos os AC têm teste?
3. Segurança — tenant-guard sobre o diff acumulado da release
4. Operacional — env.example atualizado; webhooks idempotentes; Baileys reconecta
5. Changelog — atualiza CHANGELOG.md com a release
```

Nenhum item vermelho = merge liberado.

---

### `/whatsapp-msg`

Adiciona um novo tipo de notificação WhatsApp seguindo a arquitetura obrigatória:

- Template registrado em `packages/messaging/templates/` (nome, texto pt-BR com placeholders tipados, categoria)
- Producer no serviço de negócio enfileira `{tenantId, clienteId, tipo, payload}` na `notification.queue` (BullMQ) — **nunca síncrono no request**
- Consumer no worker processa e chama o `MessagingProvider` (abstração sobre Baileys)
- Respeita opt-in/opt-out do cliente (LGPD)

---

## Referência rápida

| Situação | Use |
|---|---|
| Implementar uma US do zero | `/nova-us <ID>` |
| Criar tabela ou coluna nova | `/migration` |
| Criar componente de UI | `/novo-componente` (leia antes de escrever) |
| Criar rota ou server action | `/novo-endpoint` |
| Adicionar notificação WhatsApp | `/whatsapp-msg` |
| Verificar antes de mergear para `dev` | agents `tenant-guard` + `security-guard` + `ui-guard` |
| Verificar antes de deploy / merge para `main` | `/release-check` |
| Código diverge da spec | agente `spec-keeper` |

---

## Convenções de saída dos agentes de revisão

Todos os guardas (tenant-guard, security-guard, ui-guard) usam o mesmo formato:

```
[BLOQUEANTE] caminho/do/arquivo.ts:L42
  Descrição do problema.
  Correção: o que deve ser feito.

[ATENÇÃO] caminho/do/arquivo.tsx:L18
  Descrição do aviso.
  Correção: sugestão.

[OK] Descrição do item verificado.
```

**BLOQUEANTE** = PR não pode ser aprovado até que seja corrigido e a revisão
re-executada.

**ATENÇÃO** = deve ser corrigido antes do merge, mas não impede a revisão de
prosseguir.

**OK** = item verificado e sem problemas.
