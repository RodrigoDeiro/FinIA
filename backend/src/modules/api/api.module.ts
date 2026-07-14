import type { FastifyInstance } from 'fastify'
import { logger } from '@config/logger.js'
import { resourceRoutes } from './resource.routes.js'
import { transactionRoutes } from './transaction.routes.js'
import { eventsRoutes } from './events.routes.js'
import { budgetRoutes } from '@modules/budget/budget.routes.js'
import { goalRoutes } from '@modules/goal/goal.routes.js'
import { insightRoutes } from '@modules/insight/insight.routes.js'
import { reportRoutes } from '@modules/report/report.routes.js'

// =============================================================================
// FinIA — Módulo API (/api/v1)
// =============================================================================
//
// Superfície REST do dashboard. TODAS as rotas aqui dentro exigem autenticação:
// o hook preHandler (guard) roda antes de qualquer handler deste escopo,
// preenchendo request.auth e o contexto de tenant.
//
// Rotas públicas de auth ficam FORA (auth.module registra /api/v1/auth).
//
// =============================================================================

export async function registerApiModule(app: FastifyInstance): Promise<void> {
  await app.register(
    async (api) => {
      // Guard em TUDO que está neste escopo encapsulado
      api.addHook('preHandler', app.authenticate)

      await api.register(resourceRoutes)
      await api.register(transactionRoutes, { prefix: '/transactions' })
      await api.register(eventsRoutes)
      // Sprint 4
      await api.register(budgetRoutes, { prefix: '/budgets' })
      await api.register(goalRoutes, { prefix: '/goals' })
      await api.register(insightRoutes, { prefix: '/insights' })
      await api.register(reportRoutes, { prefix: '/reports' })
    },
    { prefix: '/api/v1' },
  )

  logger.info('Módulo API registrado (/api/v1 — REST + SSE)')
}
