---
name: migration
description: Cria e aplica migrations Postgres no modelo schema-por-tenant do Arena SaaS. Use ao criar/alterar tabelas, colunas ou indices.
---

# Migration — schema por tenant

Neste projeto cada arena tem um schema Postgres próprio (`tenant_<slug>`); o
schema `public` guarda apenas tenants, planos do SaaS e usuários globais.

## Regras
1. Migrations de tenant são escritas SEM schema hardcoded — o runner aplica em
   loop sobre todos os schemas de tenant usando `SET search_path`
2. Toda migration de tenant também atualiza o template de provisionamento
   (`packages/db/tenant-template`) para que arenas novas nasçam atualizadas
3. Migration de `public` é separada e nunca mistura objetos de tenant
4. Sempre reversível: escreva o `down` ou documente por que não há
5. Índice novo em tabela grande: criar com `CONCURRENTLY` (fora de transação)

## Processo
1. Altere o schema Drizzle em `packages/db/schema/`
2. `pnpm db:generate` — revise o SQL gerado manualmente antes de aceitar
3. Ajuste para o padrão multi-tenant (sem prefixo de schema fixo)
4. `pnpm db:migrate` em dev; confirme com `\dn` / `\dt tenant_demo.*`
5. Rode `pnpm test` — repositórios afetados podem ter quebrado

## Checklist antes de commitar
- [ ] Colunas monetárias como `integer` (centavos), nunca `numeric` float
- [ ] `tenant-template` atualizado
- [ ] Colunas de dados pessoais anotadas no comentário da coluna (LGPD)
- [ ] FK e índices para toda coluna usada em busca do PDV (nome, telefone)
