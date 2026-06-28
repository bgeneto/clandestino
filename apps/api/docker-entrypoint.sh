#!/usr/bin/env bash
set -euo pipefail

# Aplica as migrações Drizzle antes de subir a API.
echo "[entrypoint] Aplicando migrações Drizzle..."
pnpm --filter @clandestino/api db:migrate

# Seed opcional, controlado por variável de ambiente (desligado por padrão).
if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] Populando dados de desenvolvimento (seed)..."
  pnpm --filter @clandestino/api db:seed
fi

echo "[entrypoint] Iniciando API: $*"
exec "$@"
