#!/usr/bin/env bash
set -euo pipefail

# Aplica as migrações Drizzle antes de subir a API.
# O compose já garante que o Postgres está saudável (depends_on: service_healthy),
# mas mantemos o migrate aqui para que o container seja autossuficiente.
echo "[entrypoint] Aplicando migrações Drizzle..."
pnpm --filter @clandestino/api db:migrate

# Seed opcional, controlado por variável de ambiente (desligado por padrão).
if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] Populando dados de desenvolvimento (seed)..."
  pnpm --filter @clandestino/api db:seed
fi

echo "[entrypoint] Iniciando API: $*"
exec "$@"
