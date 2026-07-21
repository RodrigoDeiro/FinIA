import type { FastifyInstance } from 'fastify'
import { prisma } from '@database/prisma.js'
import { computeMonthOverview } from './month.service.js'

// =============================================================================
// FinIA — Visão do mês (/api/v1/month)
// =============================================================================
//
//   GET /?ref=YYYY-MM   visão consolidada do mês (default: mês atual)
//
// =============================================================================

export async function monthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const userId = request.auth!.userId
    const { ref } = request.query as { ref?: string }
    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: { timezone: true, currency: true },
    })
    const overview = await computeMonthOverview(userId, user!.timezone, ref)
    return { ...overview, currency: user!.currency }
  })
}
