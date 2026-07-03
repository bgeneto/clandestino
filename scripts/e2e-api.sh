#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="${E2E_DATABASE_URL:-file:./data/clandestino_e2e.db}"
export NODE_ENV="${NODE_ENV:-development}"
export PUBLIC_APP_URL="${PUBLIC_APP_URL:-http://127.0.0.1:5173}"
export ORGANIZER_ALLOWED_EMAILS="${ORGANIZER_ALLOWED_EMAILS:-organizador@gmail.com}"
export EXPOSE_MAGIC_LINKS="${EXPOSE_MAGIC_LINKS:-true}"
export AUTH_RATE_LIMIT_MAX="${AUTH_RATE_LIMIT_MAX:-1000}"

pnpm --filter @clandestino/api db:migrate
exec pnpm --filter @clandestino/api dev
