# Arena SaaS — Sistema de Gestão para Arenas (Padel / Beach Tennis)

SaaS multi-tenant para gestão de arenas: CRM, PDV/comandas, reservas de quadras,
filiação, pontos/cashback, publicidade e notificações WhatsApp.

**A especificação em `docs/spec/` é o contrato.** Nenhuma funcionalidade é
implementada sem uma US correspondente. Toda US é referenciada pelo ID
(ex.: PDV-08, PTS-01).

## Stack (decisões fechadas — não propor troca sem aprovação)

- **Next.js (App Router) + TypeScript** — painel, PDV e página pública de reservas
- **Shadcn/ui + Tailwind CSS** — biblioteca de componentes e sistema de design.
  Antes de criar qualquer componente de UI, verificar se já existe em `shadcn/ui`
  ou em `packages/ui`. Não duplicar componentes existentes.
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

1. **Isolamento de tenant — schema-por-tenant via SQL cru (MANDATÓRIO)**: toda
   leitura/escrita de dados de tenant é feita com SQL parametrizado que qualifica
   **explicitamente** o schema do tenant, `sql.identifier(\`tenant_<slug>\`)` — o
   padrão já usado em `auth.service` e no `provisioner`. O `schemaName` sempre
   passa por validação (`assertSchema`/regex) antes de entrar no SQL.
   É **PROIBIDO** em runtime: (a) depender de `search_path` implícito;
   (b) usar tabelas Drizzle qualificadas em `tenant_template`
   (`pgSchema("tenant_template").table(...)`), pois o SQL gerado fixa o schema e
   vaza dados entre arenas. O schema `tenant_template` e as migrations Drizzle
   servem **apenas** como template/referência de estrutura. Todo schema
   `tenant_<slug>` deve conter **todas** as tabelas do tenant — o `provisioner`
   cria/clona a estrutura completa ao provisionar a arena. Nenhum acesso a dados
   sem tenant resolvido; serviços recebem o `schemaName` validado, nunca criam
   conexão própria.
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
10. **Snapshot de preço**: o campo `unit_price_at_sale` (integer, centavos) é
    gravado no momento do lançamento do item e é **imutável**. Nenhuma query de
    relatório, reimpressão de comanda ou cálculo de ponto usa o preço atual do
    catálogo — sempre o preço da linha da comanda.
11. **Zero `any` e zero `@ts-ignore`**: não usar o tipo `any` explícito em
    TypeScript. Usar `unknown` com type guards, ou criar interfaces/types adequados.
    `@ts-ignore` é proibido sem comentário com justificativa técnica obrigatória.
    O CI roda `typecheck` e bloqueia o PR se houver erro.
12. **Componentes reutilizáveis — buscar antes de criar**: antes de implementar
    qualquer componente de UI ou função utilitária, buscar (Grep/Glob) se já
    existe em `packages/ui` ou em `shadcn/ui`. Não duplicar. Se precisar ajustar
    um existente, prefira extensão ou compositão ao início de um novo.
13. **Boy Scout Rule**: ao tocar em um arquivo, deixe-o mais limpo do que encontrou.
    Corrija pelo menos os erros de lint do arquivo tocado. Não introduza novos
    erros — o CI é o guardião.

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
