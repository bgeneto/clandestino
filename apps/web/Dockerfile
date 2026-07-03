# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build de produção do PWA Clandestino (Vite + PWA).
# Contexto de build esperado: raiz do monorepo (ver docker-compose.yml).
#
# Targets:
#   build  — artefatos em /app/apps/web/dist (debug)
#   export — só os estáticos em /dist (usado por web-build no compose)
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared-contracts/package.json packages/shared-contracts/
COPY packages/tournament-engine/package.json packages/tournament-engine/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@clandestino/web..."

FROM deps AS build
ARG VITE_API_URL=/api
ARG VITE_SHOW_PLAYER_SHUFFLE=
ENV VITE_API_URL="${VITE_API_URL}" \
    VITE_SHOW_PLAYER_SHUFFLE="${VITE_SHOW_PLAYER_SHUFFLE}"
COPY tsconfig.base.json ./
COPY packages/shared-contracts packages/shared-contracts
COPY packages/tournament-engine packages/tournament-engine
COPY apps/web apps/web
RUN pnpm --filter "@clandestino/web..." build

FROM alpine:3.21 AS export
COPY --from=build /app/apps/web/dist /dist
