# =============================================================================
# FinIA — Imagem de produção (backend + dashboard numa imagem só)
# =============================================================================
#
# Multi-stage:
#   1. frontend  → compila o dashboard React (Vite) → /fe/dist
#   2. backend   → instala deps, gera Prisma Client, compila TS → /app/dist
#   3. runtime   → node slim rodando a API E servindo o dashboard (same-origin)
#
# Build a partir da pasta `finia/`:
#   docker build -t finia .
#
# =============================================================================

# ---- 1. Frontend ------------------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. Backend -------------------------------------------------------------
FROM node:22-alpine AS backend
WORKDIR /app
# schema copiado ANTES do npm ci: o postinstall roda `prisma generate` (§4)
COPY backend/package.json backend/package-lock.json* ./
COPY backend/prisma ./prisma
RUN npm ci
COPY backend/ ./
RUN npm run build

# ---- 3. Runtime -------------------------------------------------------------
FROM node:22-alpine AS runtime
# openssl: exigido pelo engine do Prisma no Alpine (binaryTargets musl)
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV FRONTEND_DIST=/app/public
ENV STORAGE_PATH=/app/storage/reports

# node_modules (com Prisma Client já gerado + CLI p/ migrate), build e schema
COPY --from=backend /app/node_modules ./node_modules
COPY --from=backend /app/package.json ./package.json
COPY --from=backend /app/dist ./dist
COPY --from=backend /app/prisma ./prisma
# dashboard compilado, servido pelo backend na raiz
COPY --from=frontend /fe/dist ./public
# entrypoint: aplica migrations + seed idempotente, depois sobe o servidor
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
