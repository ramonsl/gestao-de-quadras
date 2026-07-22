FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/messaging/package.json ./packages/messaging/

# Garante instalacao de todas as devDependencies (tsx, typescript) necessarias
# para rodar o worker via tsx em produção (sem etapa de build/emit separada).
RUN npm ci --include=dev

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 worker

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=worker:nodejs package.json package-lock.json ./
COPY --chown=worker:nodejs apps/worker ./apps/worker
COPY --chown=worker:nodejs packages/core ./packages/core
COPY --chown=worker:nodejs packages/db ./packages/db
COPY --chown=worker:nodejs packages/messaging ./packages/messaging

USER worker

# Baileys persiste credenciais/pool em memória — nunca escalar horizontalmente
# este serviço sem antes revisar packages/messaging/src/baileys/session-pool.ts
# (uma sessão por tenant é mantida por processo).
CMD ["node_modules/.bin/tsx", "apps/worker/src/index.ts"]
