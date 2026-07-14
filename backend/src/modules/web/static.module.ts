import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
import { env } from '@config/env.js'
import { logger } from '@config/logger.js'

// =============================================================================
// FinIA — Static (serve o dashboard em produção)
// =============================================================================
//
// Quando FRONTEND_DIST aponta para o build do frontend (frontend/dist), o
// backend serve o SPA na raiz. Vantagem em produção: MESMA ORIGEM da API →
// os cookies httpOnly de sessão e o SSE funcionam sem CORS nem proxy.
//
// Fallback de SPA: qualquer GET que NÃO seja de API/infra (/api, /webhook,
// /admin, /health) e que o @fastify/static não encontrou como arquivo devolve
// o index.html — o React Router assume o roteamento no cliente.
//
// Em dev (FRONTEND_DIST vazio) este módulo é no-op: o Vite serve o front.
//
// =============================================================================

const NON_SPA_PREFIXES = ['/api', '/webhook', '/admin', '/health']

export async function registerStaticModule(app: FastifyInstance): Promise<void> {
  if (!env.FRONTEND_DIST) {
    logger.info('Static: FRONTEND_DIST não definido — dashboard servido pelo Vite (dev)')
    return
  }

  const root = resolve(env.FRONTEND_DIST)
  if (!existsSync(resolve(root, 'index.html'))) {
    logger.warn({ root }, 'Static: FRONTEND_DIST não contém index.html — pulando')
    return
  }

  await app.register(fastifyStatic, { root, wildcard: false })

  // Fallback de SPA para rotas do cliente (ex: /transacoes, /auth/magic)
  app.setNotFoundHandler((request, reply) => {
    if (request.method !== 'GET' || NON_SPA_PREFIXES.some((p) => request.url.startsWith(p))) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Recurso não encontrado' } })
    }
    return reply.sendFile('index.html')
  })

  logger.info({ root }, 'Static: dashboard sendo servido pelo backend')
}
