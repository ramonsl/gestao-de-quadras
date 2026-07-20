---
name: novo-endpoint
description: Scaffolding de rota/server action do Arena SaaS com tenant, permissao, validacao e auditoria embutidos. Use ao criar qualquer endpoint ou action nova.
---

# Novo endpoint / server action

Todo endpoint do Arena SaaS nasce com as quatro camadas obrigatórias. Nunca crie
rota "simples para testar depois" — o padrão é barato e evita retrabalho.

## Camadas obrigatórias (nesta ordem)
1. **Sessão + tenant**: resolva a sessão (Auth.js). Sem sessão → 401; sem tenant
   → 404. Monte o `TenantContext { db, tenantId, actorUserId }` a partir da sessão
   (helper `getArenaContext()` em `@/lib/session`) — o `tenantId` (UUID) vem da
   sessão. Passe o `ctx` para os serviços; NUNCA use uma conexão crua sem tenant
2. **Permissão**: valide o `role` contra a ação. Matriz de permissões em
   `packages/core/auth/permissions.ts` — adicione a ação lá, nunca inline
3. **Validação**: parse do input com Zod ANTES de qualquer lógica. Schema junto
   do contrato em `packages/core`, reutilizado pelo teste
4. **Serviço**: a rota só orquestra — regra de negócio vive em `packages/core`
   como função que recebe o `TenantContext` (ctx) + input validado e filtra
   `tenant_id` em toda query

## Ações sensíveis (estorno, sangria, desconto, configurações)
- Role mínimo `admin` + justificativa obrigatória no input
- Gravar auditoria via `audit.log()` na mesma transação

## Decisão server action × route handler
- Mutations do painel/PDV → **server action**
- Webhooks (Asaas), página pública de reservas, integrações → **route handler**
  (webhook valida assinatura + idempotência por ID de evento)

## Saída esperada
Rota fina (~15 linhas), serviço testável em `packages/core`, teste unitário do
serviço e caso e2e se a US pedir. Peça ao test-runner para cobrir.
