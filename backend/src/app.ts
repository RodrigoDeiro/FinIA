import Fastify, { type FastifyInstance } from 'fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import rateLimit from '@fastify/rate-limit'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter } from '@bull-board/fastify'

import { loggerOptions } from '@config/logger.js'
import { prisma } from '@database/prisma.js'
import { redis } from '@cache/redis.js'
import { errorHandler } from '@shared/middleware/error-handler.js'
import { requestIdPlugin, genReqId } from '@shared/middleware/request-id.js'
import { registerWhatsAppModule } from '@modules/whatsapp/whatsapp.module.js'
import { registerTelegramModule } from '@modules/telegram/telegram.module.js'
import { initAiModule } from '@modules/ai/ai.module.js'
import { registerAuthModule } from '@modules/auth/auth.module.js'
import { registerApiModule } from '@modules/api/api.module.js'
import { registerStaticModule } from '@modules/web/static.module.js'
import { allQueues } from '@queue/queues.js'

// =============================================================================
// FinIA — Montagem da aplicação Fastify
// =============================================================================
//
// buildApp() registra plugins, rotas e o Bull Board, mas NÃO chama listen() —
// isso fica em server.ts (e permite que os testes de integração usem o app
// via inject/supertest sem subir uma porta).
//
// =============================================================================

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions,
    genReqId,
    trustProxy: true,
    // Limite de corpo: webhooks de WhatsApp são pequenos; 1MB é folgado.
    bodyLimit: 1_048_576,
  })

  app.setErrorHandler(errorHandler)

  // ─── Plugins base ──────────────────────────────────────────────────────────
  await app.register(requestIdPlugin)
  // CSP desligado para não bloquear os assets da UI do Bull Board.
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, { origin: true, credentials: true })
  await app.register(sensible)
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  })

  // ─── Health check ──────────────────────────────────────────────────────────
  // Verifica Postgres e Redis. 200 = saudável; 503 = dependência indisponível.
  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      await redis.ping()
      return { status: 'ok', timestamp: new Date().toISOString() }
    } catch (err) {
      _request.log.error({ err }, 'Health check falhou')
      return reply.code(503).send({ status: 'degraded' })
    }
  })

  // ─── Módulo AI (opcional — degrada se sem chave) ───────────────────────────
  initAiModule()

  // ─── Módulo WhatsApp (webhook) ─────────────────────────────────────────────
  await registerWhatsAppModule(app)

  // ─── Módulo Telegram (webhook — ativado se TELEGRAM_BOT_TOKEN presente) ─────
  await registerTelegramModule(app)

  // ─── Auth + API do dashboard (Sprint 3) ────────────────────────────────────
  await registerAuthModule(app)
  await registerApiModule(app)

  // ─── Bull Board (monitor das filas) em /admin/queues ───────────────────────
  const serverAdapter = new FastifyAdapter()
  createBullBoard({
    queues: allQueues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
  })
  serverAdapter.setBasePath('/admin/queues')
  await app.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' })

  // ─── Dashboard estático (produção) — por ÚLTIMO (SPA fallback) ─────────────
  await registerStaticModule(app)

  return app
}
