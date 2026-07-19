# Arena SaaS — Sistema de Gestão para Arenas (Padel / Beach Tennis)

SaaS multi-tenant para gestão de arenas: CRM, PDV/comandas, reservas de quadras,
filiação, pontos/cashback, publicidade e notificações WhatsApp.

**A especificação em `docs/spec/` é o contrato.** Nenhuma funcionalidade é
implementada sem uma US correspondente. Toda US é referenciada pelo ID
(ex.: PDV-08, PTS-01).

## Stack (decisões fechadas — não propor troca sem aprovação)

- **Next.js (App Router) + TypeScript** — painel, PDV e página pública de reservas
- **Worker Node separado** (`apps/worker`) com **BullMQ + Redis** — Baileys, filas de
  notificação, cobranças recorrentes, jobs de CRM (aniversário/inatividade)
- **PostgreSQL** — **um schema por tenant** (`tenant_<slug>`) + schema `public` para
  registro de tenants, planos SaaS e usuários globais
- **Drizzle ORM** + migrations versionadas aplicadas a todos os schemas
- **Auth.js** — sessão com `tenantId`, `role` (admin | gerente | atendente) e `modulesAllowed`
- **Asaas** — cobrança recorrente (filiação e assinaturas do SaaS)
- **Baileys** — WhatsApp, SEMPRE atrás da interface `MessagingProvider` (nunca
  importar Baileys fora de `packages/messaging`)
- **Vitest** (testes de função) + **Playwright** (e2e) + GitHub Actions

## Regras invioláveis

1. **Isolamento de tenant**: toda query roda com `search_path` do tenant da sessão.
   Nenhum acesso a dados sem tenant resolvido. Repositórios recebem `tenantDb`,
   nunca criam conexão própria.
2. **Testes obrigatórios**: toda função de serviço tem teste unitário (Vitest);
   toda US tem teste e2e (Playwright) derivado dos critérios de aceite. PR sem
   teste não é aceito.
3. **Permissões**: toda rota/ação valida o `role` E os `modulesAllowed` da sessão.
   Papéis: `admin` (irrestrito), `gerente` (operacional), `atendente` (PDV/grade).
   Ações sensíveis (estorno, sangria, desconto manual, config de pontos) exigem
   `admin` ou `gerente` e geram registro de auditoria. Cancelamentos e estornos
   por `atendente` exigem autorização explícita de `admin` ou `gerente`.
4. **WhatsApp**: mensagens saem apenas pela fila (`notification.queue`), nunca
   síncronas no request. Respeitar opt-in/opt-out (LGPD).
5. **Pontos**: crédito só no fechamento da comanda; estorno de item estorna
   pontos; pagamento com pontos não gera pontos.
6. **Dinheiro**: valores monetários em centavos (integer). Nunca float.
7. **Spec viva**: divergência entre código e spec → atualizar `docs/spec/` no
   mesmo PR (agente spec-keeper).
8. **Identidade global de clientes**: o WhatsApp é o identificador universal
   (`global_customers` no schema `public`). Pontos, comandas e histórico são
   **sempre isolados** no schema do tenant. Nenhuma query pode cruzar saldo,
   comanda ou pontuação de um cliente entre arenas distintas.
9. **Backoffice Core**: login e credenciais do painel Core (SAAS-11) vivem no
   schema `public`. Nunca misturar autenticação de tenant com a do Core.

## Fluxo de trabalho (spec-driven)

Para implementar qualquer US, na ordem:

1. Ler a US e seus critérios de aceite em `docs/spec/`
2. Subagente **planner** produz o plano técnico (arquivos, contratos, migrations)
3. Implementar exatamente o plano — escopo além da US = novo plano
4. Subagente **test-runner** escreve/roda testes (unit + e2e dos AC)
5. Subagente **tenant-guard** revisa o diff (isolamento, permissões, auditoria)
6. Commit `feat(PDV-08): ...` referenciando a US; PR fecha a issue correspondente

## Comandos

```bash
pnpm dev          # next + worker + redis/postgres via docker compose
pnpm test         # vitest (unit)
pnpm e2e          # playwright
pnpm db:generate  # gera migration a partir do schema Drizzle
pnpm db:migrate   # aplica migrations em todos os schemas de tenant
pnpm lint && pnpm typecheck
```

## Convenções

- Monorepo pnpm: `apps/web`, `apps/worker`, `packages/db`, `packages/core`
  (serviços puros), `packages/messaging`
- Lógica de negócio em `packages/core` como funções puras (testáveis sem HTTP/DB
  mockando repositórios) — componentes e rotas ficam finos
- Validação com Zod em toda borda (rotas, server actions, jobs, webhooks)
- Nomes de arquivos e código em inglês; textos de UI e mensagens em pt-BR
- Ver `docs/boas-praticas-nextjs.md` antes de criar páginas/rotas
