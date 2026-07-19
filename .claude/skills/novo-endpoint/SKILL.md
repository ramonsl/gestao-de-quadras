---
name: novo-endpoint
description: Scaffolding de rota/server action do Arena SaaS com tenant, permissao, validacao e auditoria embutidos. Use ao criar qualquer endpoint ou action nova.
---

# Novo endpoint / server action

Todo endpoint do Arena SaaS nasce com as quatro camadas obrigatórias. Nunca crie rota "simples para testar depois" — o padrão é barato e evita retrabalho.

## Camadas obrigatórias (nesta ordem)
1. **Sessão + tenant**: resolva a sessão (Auth.js) e o tenant (subdomínio via middleware). Sem sessão = 401. Sem tenant = 404. Use o helper `withTenant(handler)` existente; não reimplemente
2. **Permissão**: valide o `role` contra a ação. Matriz de permissões em `packages/core/auth/permissions.ts` — adicione a ação lá, nunca inline
3. **Validação**: parse do input com Zod ANTES de qualquer lógica. Schema junto do contrato em `packages/core`, reutilizado pelo teste
4. **Serviço**: a rota só orquestra — regra de negócio vive em `packages/core` como função pura que recebe `tenantDb` + input validado

## Ações sensíveis (estorno, sangria, desconto, configurações)
- Role mínimo `admin` + justificativa obrigatória no input
- Gravar auditoria via `audit.log()` na mesma transação

## Decisão server action x route handler
- Mutations do painel/PDV = **server action**
- Webhooks (Asaas), página pública de reservas, integrações = **route handler** (webhook valida assinatura + idempotência por ID de evento)

## Saída esperada
Rota fina (~15 linhas), serviço testável em `packages/core`, teste unitário do serviço e caso e2e se a US pedir. Peça ao test-runner para cobrir.
