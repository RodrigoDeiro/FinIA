#!/bin/sh
# =============================================================================
# FinIA — Entrypoint de produção
# =============================================================================
# Ordem: aplica migrations (deploy, não dev) → seed idempotente → sobe o server.
# `exec` no final: o node vira PID 1 e recebe SIGTERM (graceful shutdown).
# =============================================================================
set -e

echo "[FinIA] Aplicando migrations do banco..."
npx prisma migrate deploy

echo "[FinIA] Seed idempotente (categorias + merchants)..."
npx tsx prisma/seed.ts

echo "[FinIA] Iniciando servidor..."
exec node dist/server.js
