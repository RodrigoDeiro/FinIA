import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@database/prisma.js'

// =============================================================================
// FinIA — Recorrentes (/api/v1/recurring)
// =============================================================================
//
//   GET    /       lista renda fixa + contas fixas
//   POST   /       cria
//   PATCH  /:id    edita (valor, descrição, ativo, categoria, dia)
//   DELETE /:id    remove (soft-delete)
//
// =============================================================================

const createBody = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  description: z.string().trim().min(1).max(200),
  amount: z.number().positive(),
  categoryId: z.string().optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
})

const updateBody = z.object({
  description: z.string().trim().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
  categoryId: z.string().optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  active: z.boolean().optional(),
})

const select = {
  id: true,
  type: true,
  description: true,
  amount: true,
  categoryId: true,
  dayOfMonth: true,
  active: true,
} as const

export async function recurringRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const items = await prisma.recurringEntry.findMany({
      where: { userId: request.auth!.userId, deletedAt: null },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
      select,
    })
    return { items }
  })

  app.post('/', async (request, reply) => {
    const parsed = createBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Dados inválidos' } })
    }
    const item = await prisma.recurringEntry.create({
      data: {
        userId: request.auth!.userId,
        type: parsed.data.type,
        description: parsed.data.description.trim(),
        amount: parsed.data.amount,
        categoryId: parsed.data.categoryId || null,
        dayOfMonth: parsed.data.dayOfMonth ?? null,
      },
      select,
    })
    return reply.code(201).send({ item })
  })

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updateBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Dados inválidos' } })
    }
    const found = await prisma.recurringEntry.findFirst({
      where: { id, userId: request.auth!.userId, deletedAt: null },
      select: { id: true },
    })
    if (!found) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Não encontrado' } })

    const item = await prisma.recurringEntry.update({
      where: { id },
      data: {
        ...(parsed.data.description !== undefined ? { description: parsed.data.description.trim() } : {}),
        ...(parsed.data.amount !== undefined ? { amount: parsed.data.amount } : {}),
        ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId || null } : {}),
        ...(parsed.data.dayOfMonth !== undefined ? { dayOfMonth: parsed.data.dayOfMonth } : {}),
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      },
      select,
    })
    return { item }
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const found = await prisma.recurringEntry.findFirst({
      where: { id, userId: request.auth!.userId, deletedAt: null },
      select: { id: true },
    })
    if (!found) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Não encontrado' } })
    await prisma.recurringEntry.update({ where: { id }, data: { deletedAt: new Date() } })
    return reply.code(204).send()
  })
}
