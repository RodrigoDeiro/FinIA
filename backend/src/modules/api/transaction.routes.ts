import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { TransactionType } from '@prisma/client'
import { tenantPrisma } from '@database/tenant.prisma.js'
import { cacheService } from '@cache/cache.service.js'
import { REDIS_KEYS } from '@config/constants.js'
import { ValidationError, NotFoundError } from '@shared/errors/index.js'
import { EVENTS, emitTransactionEvent } from '@shared/events/event.bus.js'
import { createTransaction } from '@modules/transaction/transaction.service.js'
import { toTransactionDTO } from './transaction.dto.js'
import { assertCategoryUsable } from './api.validators.js'

// =============================================================================
// FinIA — Rotas de Transações (/api/v1/transactions)
// =============================================================================
//
// Todas passam pelo guard (registrado no api.module) → tenantPrisma filtra
// automaticamente por usuário e por deletedAt (soft delete).
//
// Padrão de segurança: nada de findUnique/update/delete por id puro — sempre
// findFirst/updateMany, onde o filtro de tenant é injetado. count 0 ⇒ 404.
//
// =============================================================================

const listQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  categoryId: z.string().optional(),
  needsReview: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const createBodySchema = z.object({
  type: z.nativeEnum(TransactionType),
  amount: z.number().positive(),
  date: z.coerce.date(),
  description: z.string().max(500).nullish(),
  merchantName: z.string().max(120).nullish(),
  categoryId: z.string().nullish(),
  accountId: z.string().optional(),
})

const updateBodySchema = z
  .object({
    amount: z.number().positive().optional(),
    date: z.coerce.date().optional(),
    description: z.string().max(500).nullable().optional(),
    merchantName: z.string().max(120).nullable().optional(),
    categoryId: z.string().optional(),
    needsReview: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nada para atualizar' })

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET / — listagem com filtros e paginação ──────────────────────────────
  app.get('/', async (request) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success) throw new ValidationError('Filtros inválidos', q.error.flatten().fieldErrors)
    const { from, to, type, categoryId, needsReview, page, pageSize } = q.data

    const where = {
      ...(type ? { type } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(needsReview !== undefined ? { needsReview: needsReview === 'true' } : {}),
      ...(from || to
        ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    }

    const [items, total] = await Promise.all([
      tenantPrisma.transaction.findMany({
        where,
        include: { category: { select: { name: true } } },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tenantPrisma.transaction.count({ where }),
    ])

    return { items: items.map(toTransactionDTO), page, pageSize, total }
  })

  // ─── POST / — criação manual pelo dashboard ────────────────────────────────
  app.post('/', async (request, reply) => {
    const body = createBodySchema.safeParse(request.body)
    if (!body.success) throw new ValidationError('Dados inválidos', body.error.flatten().fieldErrors)
    const data = body.data
    const userId = request.auth!.userId

    if (data.categoryId) await assertCategoryUsable(data.categoryId, userId)
    if (data.accountId) {
      const account = await tenantPrisma.account.findFirst({
        where: { id: data.accountId },
        select: { id: true },
      })
      if (!account) throw new ValidationError('Conta inválida')
    }

    const transaction = await createTransaction({
      userId,
      type: data.type,
      amount: data.amount,
      date: data.date,
      description: data.description ?? null,
      merchantName: data.merchantName ?? null,
      categoryId: data.categoryId ?? null,
      accountId: data.accountId,
      source: 'WEB',
      parseMethod: 'MANUAL',
    })

    const withCategory = await tenantPrisma.transaction.findFirst({
      where: { id: transaction.id },
      include: { category: { select: { name: true } } },
    })
    return reply.code(201).send(toTransactionDTO(withCategory!))
  })

  // ─── PATCH /:id — edição (inclui corrigir categoria/limpar needsReview) ────
  app.patch('/:id', async (request) => {
    const { id } = request.params as { id: string }
    const body = updateBodySchema.safeParse(request.body)
    if (!body.success) throw new ValidationError('Dados inválidos', body.error.flatten().fieldErrors)
    const data = body.data
    const userId = request.auth!.userId

    if (data.categoryId) await assertCategoryUsable(data.categoryId, userId)

    // updateMany: o tenant filter é injetado — só atualiza se for do usuário
    const result = await tenantPrisma.transaction.updateMany({
      where: { id, deletedAt: null },
      data,
    })
    if (result.count === 0) throw new NotFoundError('Transação', id)

    await cacheService.del(REDIS_KEYS.userCache(userId))

    const updated = await tenantPrisma.transaction.findFirst({
      where: { id },
      include: { category: { select: { name: true } } },
    })
    emitTransactionEvent(EVENTS.TRANSACTION_UPDATED, {
      userId,
      transactionId: id,
      type: updated!.type,
      amount: Number(updated!.amount),
      merchantName: updated!.merchantName,
      categoryId: updated!.categoryId,
      date: updated!.date.toISOString(),
      needsReview: updated!.needsReview,
    })
    return toTransactionDTO(updated!)
  })

  // ─── DELETE /:id — soft delete ─────────────────────────────────────────────
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const userId = request.auth!.userId

    const existing = await tenantPrisma.transaction.findFirst({ where: { id } })
    if (!existing) throw new NotFoundError('Transação', id)

    await tenantPrisma.transaction.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    await cacheService.del(REDIS_KEYS.userCache(userId))

    emitTransactionEvent(EVENTS.TRANSACTION_DELETED, {
      userId,
      transactionId: id,
      type: existing.type,
      amount: Number(existing.amount),
      merchantName: existing.merchantName,
      categoryId: existing.categoryId,
      date: existing.date.toISOString(),
      needsReview: existing.needsReview,
    })
    return reply.code(204).send()
  })
}
