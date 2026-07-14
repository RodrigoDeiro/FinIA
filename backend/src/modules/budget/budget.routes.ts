import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { BudgetPeriod } from '@prisma/client'
import { prisma } from '@database/prisma.js'
import { tenantPrisma } from '@database/tenant.prisma.js'
import { ValidationError, NotFoundError } from '@shared/errors/index.js'
import { assertCategoryUsable } from '@modules/api/api.validators.js'
import { computeBudgetStatus } from './budget.service.js'

// =============================================================================
// FinIA — Rotas de Orçamentos (/api/v1/budgets)
// =============================================================================

const createSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().positive(),
  period: z.nativeEnum(BudgetPeriod).default('MONTHLY'),
  alertThreshold: z.number().min(0.1).max(1).default(0.8),
})

const updateSchema = z
  .object({
    amount: z.number().positive().optional(),
    period: z.nativeEnum(BudgetPeriod).optional(),
    alertThreshold: z.number().min(0.1).max(1).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para atualizar' })

export async function budgetRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET / — lista com status do período corrente ──────────────────────────
  app.get('/', async (request) => {
    const userId = request.auth!.userId
    const [budgets, user] = await Promise.all([
      tenantPrisma.budget.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.user.findFirst({ where: { id: userId }, select: { timezone: true } }),
    ])

    const categories = await prisma.category.findMany({
      where: { id: { in: budgets.map((b) => b.categoryId) } },
      select: { id: true, name: true },
    })
    const nameById = new Map(categories.map((c) => [c.id, c.name]))

    const items = await Promise.all(
      budgets.map(async (b) => {
        const status = await computeBudgetStatus(b, user!.timezone)
        return {
          id: b.id,
          categoryId: b.categoryId,
          categoryName: nameById.get(b.categoryId) ?? null,
          amount: Number(b.amount),
          period: b.period,
          alertThreshold: Number(b.alertThreshold),
          active: b.active,
          spent: status.spent,
          remaining: status.remaining,
          ratio: status.ratio,
        }
      }),
    )
    return { budgets: items }
  })

  // ─── POST / — cria orçamento ───────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const body = createSchema.safeParse(request.body)
    if (!body.success) throw new ValidationError('Dados inválidos', body.error.flatten().fieldErrors)
    const userId = request.auth!.userId
    await assertCategoryUsable(body.data.categoryId, userId)

    // Um orçamento ativo por categoria+período evita alertas duplicados
    const existing = await tenantPrisma.budget.findFirst({
      where: { categoryId: body.data.categoryId, period: body.data.period, active: true },
    })
    if (existing) throw new ValidationError('Já existe um orçamento ativo para esta categoria e período')

    const budget = await tenantPrisma.budget.create({
      data: {
        userId,
        categoryId: body.data.categoryId,
        amount: body.data.amount,
        period: body.data.period,
        alertThreshold: body.data.alertThreshold,
        startDate: new Date(),
      },
    })
    return reply.code(201).send({ id: budget.id })
  })

  // ─── PATCH /:id ────────────────────────────────────────────────────────────
  app.patch('/:id', async (request) => {
    const { id } = request.params as { id: string }
    const body = updateSchema.safeParse(request.body)
    if (!body.success) throw new ValidationError('Dados inválidos', body.error.flatten().fieldErrors)

    const result = await tenantPrisma.budget.updateMany({
      where: { id, deletedAt: null },
      data: body.data,
    })
    if (result.count === 0) throw new NotFoundError('Orçamento', id)
    return { ok: true }
  })

  // ─── DELETE /:id — soft delete ─────────────────────────────────────────────
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await tenantPrisma.budget.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), active: false },
    })
    if (result.count === 0) throw new NotFoundError('Orçamento', id)
    return reply.code(204).send()
  })
}
