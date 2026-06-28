# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Imagem da API Clandestino (Fastify + Drizzle).
# Contexto de build esperado: raiz do monorepo (ver docker-compose.yml).
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# Stage de dependências: aproveita cache instalando só os manifests primeiro.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared-contracts/package.json packages/shared-contracts/
COPY packages/tournament-engine/package.json packages/tournament-engine/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@clandestino/api..."

# ---------------------------------------------------------------------------
# Stage de build: compila shared-contracts, tournament-engine e a API.
# ---------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared-contracts packages/shared-contracts
COPY packages/tournament-engine packages/tournament-engine
COPY apps/api apps/api
RUN pnpm --filter "@clandestino/api..." build

# ---------------------------------------------------------------------------
# Stage final de runtime.
# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json /app/
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/shared-contracts /app/packages/shared-contracts
COPY --from=build /app/packages/tournament-engine /app/packages/tournament-engine
COPY --from=build /app/apps/api /app/apps/api

COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/server.js"]
