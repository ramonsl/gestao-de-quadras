---
name: migration
description: Cria e aplica migrations Postgres no modelo row-level (tenant_id) do Arena SaaS. Use ao criar/alterar tabelas, colunas ou indices.
---

# Migration — schema único, multi-tenant por `tenant_id`

Neste projeto há **um único schema** (`public`). O isolamento entre arenas é por
**discriminador de linha**: toda tabela com escopo de arena tem
`tenant_id uuid NOT NULL REFERENCES tenants(id)`. Tabelas globais (`tenants`,
`users`, `global_customers`) NÃO têm `tenant_id`.

## Regras
1. **Uma migration, aplicada uma vez** — não há replicação por schema de tenant.
   `drizzle-kit generate` + `migrate` padrão.
2. Toda tabela de arena nova nasce com `tenant_id` (FK → `tenants`, `ON DELETE CASCADE`)
   e é adicionada a `TENANT_SCOPED_TABLES` em `packages/db/src/schema.ts`.
3. Índices e chaves de unicidade de dados de arena são **compostos com `tenant_id`**
   (ex.: `UNIQUE (tenant_id, whatsapp)`, não `UNIQUE (whatsapp)`).
4. RLS (Row-Level Security) está previsto como reforço; quando entrar, cada tabela
   de arena ganha `ENABLE ROW LEVEL SECURITY` + política por `current_setting('app.current_tenant')`.
5. Índice novo em tabela grande: criar com `CONCURRENTLY` (fora de transação).

## Processo
1. Altere o schema Drizzle em `packages/db/src/schema.ts` (coluna `tenant_id` +
   índices compostos).
2. `pnpm db:generate` — revise o SQL gerado manualmente antes de aceitar.
3. `pnpm db:migrate` em dev (runner Drizzle padrão).
4. Rode `pnpm test` — serviços afetados podem ter quebrado.

## Checklist antes de commitar
- [ ] Tabela de arena tem `tenant_id` NOT NULL + FK → `tenants`
- [ ] Índices/uniques de dados de arena são compostos com `tenant_id`
- [ ] Tabela adicionada a `TENANT_SCOPED_TABLES` (schema.ts)
- [ ] Colunas monetárias como `integer` (centavos), nunca `numeric` float
- [ ] Colunas de dados pessoais anotadas no comentário da coluna (LGPD)
- [ ] Toda query nova do serviço filtra `WHERE tenant_id = ${ctx.tenantId}`
