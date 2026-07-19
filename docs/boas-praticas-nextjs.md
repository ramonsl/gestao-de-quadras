# Boas práticas — Next.js no Arena SaaS

## Por que Next.js (e o limite dele)

Next.js (App Router + TypeScript) é a escolha certa para este produto: um só framework cobre o painel da arena, o PDV em tablet e a página pública de reservas (SSR = SEO por arena). O limite: **Baileys e filas precisam de processo Node de longa duração**, que não vive dentro do modelo serverless do Next. Por isso o worker (`apps/worker`) é um serviço separado no monorepo — o Next nunca mantém sessão de WhatsApp nem processa fila.

## Estrutura

- `apps/web/` — Next.js (App Router): `app/(painel)`, `app/(publico)`, `app/api/webhooks`, `e2e/`
- `apps/worker/` — BullMQ: notificações, cobranças, jobs de CRM, Baileys
- `packages/core/` — regra de negócio pura (alvo dos testes de função)
- `packages/db/` — Drizzle: schemas, migrations, tenant-template
- `packages/messaging/` — MessagingProvider (único lugar que conhece Baileys)

## Regras de ouro

1. **Server Components por padrão.** "use client" só com interatividade real (PDV, grade de reservas). Data fetching no servidor, nunca fetch de dados sensíveis no client.
2. **Multi-tenant no middleware.** O subdomínio resolve o tenant uma única vez (middleware = header interno). Componentes e serviços recebem o contexto do tenant; nada de "descobrir o tenant" espalhado pelo código.
3. **Mutations = server actions; integrações = route handlers.** Webhook do Asaas valida assinatura e é idempotente por ID de evento.
4. **Rotas finas, serviços puros.** Página/action orquestra; a regra vive em `packages/core` como função pura recebendo `tenantDb` + input Zod. É isso que torna o teste de função barato — sem mockar HTTP nem Next.
5. **Zod em toda borda**: actions, handlers, jobs, webhooks e `env.ts` (validar variáveis de ambiente no boot; build falha se faltar env).
6. **Dinheiro em centavos** (integer) do banco até a UI; formatação apenas na borda de exibição (`Intl.NumberFormat('pt-BR')`).
7. **PDV é touch-first**: botões grandes, busca com debounce, optimistic UI nos lançamentos de comanda com reconciliação — o caixa não pode esperar.
8. **Cache com cuidado em multi-tenant**: nada de cache global de dados de tenant. `revalidateTag` com tag prefixada pelo tenant (`t:{id}:comandas`).
9. **Nada de `any`, nada de `@ts-ignore`** sem comentário justificando. CI roda `typecheck` e bloqueia.

## Testes (obrigatórios — regra do CLAUDE.md)

- **Função (Vitest)**: toda função de `packages/core`. Repositórios fake em memória; cobre caminho feliz + erros de negócio + limites. Rápido (< 30s a suíte)
- **e2e (Playwright)**: um spec por US, nomeado pelo ID (`pdv-08.spec.ts`), roteiro derivado dos critérios de aceite. Fixtures criam tenant + usuários de teste; `FakeMessagingProvider` no lugar do Baileys; Asaas em sandbox/mock
- **Isolamento**: suíte dedicada provando que tenant B nunca lê dados do tenant A
- CI (GitHub Actions): lint = typecheck = unit = e2e em Postgres/Redis de serviço. PR só mergeia verde

## Hospedagem (decisão registrada)

**VPS no início; nuvem gerenciada quando doer.** Justificativa: Baileys exige processo persistente (Vercel/serverless não serve), e uma VPS de 4 vCPU/8 GB (~R$ 80-150/mês em Hetzner/DigitalOcean/Contabo) roda Next + worker + Redis + Postgres para dezenas de arenas com folga. AWS na largada adiciona custo e complexidade (RDS + ECS + ElastiCache facilmente > R$ 800/mês) sem benefício proporcional neste estágio.

Setup recomendado na VPS:
- **Coolify ou Dokploy** (deploy git-push, SSL automático, zero-downtime)
- Docker Compose: web, worker, redis, postgres
- **Backup diário do Postgres para S3/Backblaze B2 (fora da VPS)** — inegociável; backup por schema permite restaurar uma arena individualmente
- Subdomínio curinga `*.dominio.com.br` apontado para a VPS (tenant por subdomínio)
- Monitoramento: Uptime Kuma + alertas de queda de sessão Baileys

Gatilhos para migrar (para AWS/GCP ou Postgres gerenciado): > ~50 arenas ativas, necessidade de SLA formal, ou equipe > 3 devs. A arquitetura em containers torna a migração um exercício de infra, não de código.
