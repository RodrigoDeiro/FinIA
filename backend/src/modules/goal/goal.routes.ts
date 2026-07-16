import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GoalStatus } from '@prisma/client'
import { prisma } from '@database/prisma.js'
import { tenantPrisma } from '@database/tenant.prisma.js'
import { round2 } from '@shared/utils/currency.util.js'
import { ValidationError, NotFoundError } from '@shared/errors/index.js'
import * as notificationService from '@modules/notification/notification.service.js'
import { goalAchievedTemplate } from '@modules/notification/templates/index.js'

// =============================================================================
// FinIA — Rotas de Metas (/api/v1/goals)
// =============================================================================
//
// Metas financeiras com progresso. Depósitos via POST /:id/deposit — ao
// atingir o alvo, o status vira ACHIEVED e o usuário recebe parabéns no
// WhatsApp (o telefone é o canal-mãe do produto).
//
// =============================================================================

const createSchema = z.object({
  name: z.string().min(1).max(120),
  targetAmount: z.number().positive(),
  description: z.string().max(500).nullish(),
  deadline: z.coerce.date().nullish(),
})

const updateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    targetAmount: z.number().positive().optional(),
    description: z.string().max(500).nullable().optional(),
    deadline: z.coerce.date().nullable().optional(),
    status: z.nativeEnum(GoalStatus).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para atualizar' })

const depositSchema = z.object({ amount: z.number().positive() })

export async function goalRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET / ──────────────────────────────────────────────────────────────────
  app.get('/', async () => {
    const goals = await tenantPrisma.goal.findMany({ orderBy: { createdAt: 'asc' } })
    return {
      goals: goals.map((g) => {
        const target = Number(g.targetAmount)
        const current = Number(g.currentAmount)
        return {
          id: g.id,
          name: g.name,
          description: g.description,
          targetAmount: target,
          currentAmount: current,
          progress: target > 0 ? round2(current / target) : 0,
          deadline: g.deadline?.toISOString() ?? null,
          status: g.status,
        }
      }),
    }
  })

  // ─── POST / ─────────────────────────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const body = createSchema.safeParse(request.body)
    if (!body.success) throw new ValidationError('Dados inválidos', body.error.flatten().fieldErrors)

    const goal = await tenantPrisma.goal.create({
      data: {
        userId: request.auth!.userId,
        name: body.data.name,
        targetAmount: body.data.targetAmount,
        description: body.data.description ?? null,
        deadline: body.data.deadline ?? null,
      },
    })
    return reply.code(201).send({ id: goal.id })
  })

  // ─── PATCH /:id ─────────────────────────────────────────────────────────────
  app.patch('/:id', async (request) => {
    const { id } = request.params as { id: string }
    const body = updateSchema.safeParse(request.body)
    if (!body.success) throw new ValidationError('Dados inválidos', body.error.flatten().fieldErrors)

    const result = await tenantPrisma.goal.updateMany({
      where: { id, deletedAt: null },
      data: body.data,
    })
    if (result.count === 0) throw new NotFoundError('Meta', id)
    return { ok: true }
  })

  // ─── POST /:id/deposit — registra progresso ────────────────────────────────
  app.post('/:id/deposit', async (request) => {
    const { id } = request.params as { id: string }
    const body = depositSchema.safeParse(request.body)
    if (!body.success) throw new ValidationError('Dados inválidos', body.error.flatten().fieldErrors)
    const userId = request.auth!.userId

    const goal = await tenantPrisma.goal.findFirst({ where: { id, status: 'ACTIVE' } })
    if (!goal) throw new NotFoundError('Meta ativa', id)

    const newAmount = round2(Number(goal.currentAmount) + body.data.amount)
    const achieved = newAmount >= Number(goal.targetAmount)

    await tenantPrisma.goal.updateMany({
      where: { id },
      data: { currentAmount: newAmount, ...(achieved ? { status: 'ACHIEVED' } : {}) },
    })

    if (achieved) {
      const user = await prisma.user.findFirst({
        where: { id: userId },
        select: { phoneNumber: true, currency: true },
      })
      if (user?.phoneNumber) {
        await notificationService.sendText(
          user.phoneNumber,
          goalAchievedTemplate(goal.name, Number(goal.targetAmount), user.currency),
          userId,
        )
      }
    }

    return { currentAmount: newAmount, achieved }
  })

  // ─── DELETE /:id — soft delete ─────────────────────────────────────────────
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await tenantPrisma.goal.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    if (result.count === 0) throw new NotFoundError('Meta', id)
    return reply.code(204).send()
  })
}
