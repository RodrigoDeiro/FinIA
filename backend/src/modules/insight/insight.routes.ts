import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tenantPrisma } from '@database/tenant.prisma.js'
import { NotFoundError, ValidationError } from '@shared/errors/index.js'
import { insightQueue } from '@queue/queues.js'
import { INSIGHT_JOB_NAME } from '@queue/jobs/insight.job.js'

// =============================================================================
// FinIA — Rotas de Insights (/api/v1/insights)
// =============================================================================
//
//   GET  /            lista (filtro unseen)
//   POST /generate    dispara geração sob demanda (fila — assíncrono)
//   PATCH /:id/seen | /:id/dismiss
//
// =============================================================================

const listQuery = z.object({
  unseen: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

export async function insightRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const q = listQuery.safeParse(request.query)
    if (!q.success) throw new ValidationError('Filtros inválidos', q.error.flatten().fieldErrors)

    const insights = await tenantPrisma.aIInsight.findMany({
      where: {
        dismissedAt: null,
        ...(q.data.unseen === 'true' ? { seenAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: q.data.limit,
    })

    return {
      insights: insights.map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        body: i.body,
        aiGenerated: i.aiGenerated,
        seenAt: i.seenAt,
        createdAt: i.createdAt,
      })),
    }
  })

  app.post('/generate', async (request, reply) => {
    await insightQueue.add(INSIGHT_JOB_NAME, {
      userId: request.auth!.userId,
      trigger: 'demand',
    })
    return reply.code(202).send({ status: 'queued' })
  })

  app.patch('/:id/seen', async (request) => {
    const { id } = request.params as { id: string }
    const result = await tenantPrisma.aIInsight.updateMany({
      where: { id, seenAt: null },
      data: { seenAt: new Date() },
    })
    if (result.count === 0) throw new NotFoundError('Insight', id)
    return { ok: true }
  })

  app.patch('/:id/dismiss', async (request) => {
    const { id } = request.params as { id: string }
    const result = await tenantPrisma.aIInsight.updateMany({
      where: { id, dismissedAt: null },
      data: { dismissedAt: new Date() },
    })
    if (result.count === 0) throw new NotFoundError('Insight', id)
    return { ok: true }
  })
}
