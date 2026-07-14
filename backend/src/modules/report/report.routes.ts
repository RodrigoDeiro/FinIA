import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tenantPrisma } from '@database/tenant.prisma.js'
import { storage } from '@shared/storage/storage.js'
import { NotFoundError, ValidationError } from '@shared/errors/index.js'
import { requestMonthlyReport } from './report.service.js'

// =============================================================================
// FinIA — Rotas de Relatórios (/api/v1/reports)
// =============================================================================
//
//   POST /              solicita relatório (202 — geração assíncrona na fila)
//   GET  /              lista relatórios do usuário
//   GET  /:id/download  baixa o HTML (só COMPLETED)
//
// =============================================================================

const createSchema = z.object({
  reportType: z.literal('monthly_summary').default('monthly_summary'),
  /** Qualquer data dentro do mês desejado (default: mês corrente) */
  monthRef: z.coerce.date().optional(),
})

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', async (request, reply) => {
    const body = createSchema.safeParse(request.body ?? {})
    if (!body.success) throw new ValidationError('Dados inválidos', body.error.flatten().fieldErrors)

    const report = await requestMonthlyReport(request.auth!.userId, body.data.monthRef)
    return reply.code(202).send({ id: report.id, status: report.status })
  })

  app.get('/', async () => {
    const reports = await tenantPrisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return {
      reports: reports.map((r) => ({
        id: r.id,
        reportType: r.reportType,
        status: r.status,
        format: r.format,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        fileSize: r.fileSize,
        errorMessage: r.errorMessage,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
    }
  })

  app.get('/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string }

    const report = await tenantPrisma.report.findFirst({ where: { id } })
    if (!report) throw new NotFoundError('Relatório', id)
    if (report.status !== 'COMPLETED' || !report.filePath) {
      throw new ValidationError(`Relatório ainda não está pronto (status: ${report.status})`)
    }

    const content = await storage.read(report.filePath)
    await tenantPrisma.report.updateMany({
      where: { id, downloadedAt: null },
      data: { downloadedAt: new Date() },
    })

    return reply
      .type('text/html; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="finia-relatorio-${id}.html"`)
      .send(content)
  })
}
