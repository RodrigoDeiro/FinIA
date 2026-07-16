import type { FastifyInstance } from 'fastify'
import type { CreditPurchase } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@database/prisma.js'

// =============================================================================
// FinIA — Rotas de Cartão de Crédito (/api/v1/credit-purchases)
// =============================================================================
//
//   GET    /   lista as compras parceladas + resumo (comprometido/mês, dívida)
//   POST   /   cria uma compra parcelada
//   DELETE /:id  remove (soft-delete)
//
// As parcelas não são linhas separadas: o progresso (pagas/faltam/valor mensal)
// é calculado a partir de firstDueDate + installments no momento da consulta.
//
// =============================================================================

const createBody = z.object({
  description: z.string().trim().min(1).max(200),
  totalAmount: z.number().positive(),
  installments: z.number().int().min(1).max(72),
  firstDueDate: z.string().min(1),
  card: z.string().trim().max(60).optional().nullable(),
})

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

const round2 = (n: number): number => Math.round(n * 100) / 100

function compute(cp: CreditPurchase) {
  const total = Number(cp.totalAmount)
  const installmentAmount = round2(total / cp.installments)

  // Nº de parcelas já vencidas (inclui o mês da 1ª parcela). 0 se ainda no futuro.
  const elapsed = monthsBetween(cp.firstDueDate, new Date()) + 1
  const paidCount = Math.max(0, Math.min(cp.installments, elapsed))
  const remainingCount = cp.installments - paidCount

  const paidAmount = remainingCount === 0 ? total : round2(paidCount * installmentAmount)
  const remainingAmount = remainingCount === 0 ? 0 : round2(total - paidAmount)

  return {
    id: cp.id,
    description: cp.description,
    card: cp.card,
    totalAmount: total,
    installments: cp.installments,
    firstDueDate: cp.firstDueDate,
    installmentAmount,
    paidCount,
    remainingCount,
    paidAmount,
    remainingAmount,
    progress: cp.installments > 0 ? paidCount / cp.installments : 0,
  }
}

export async function creditRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET / — lista + resumo ────────────────────────────────────────────────
  app.get('/', async (request) => {
    const userId = request.auth!.userId
    const rows = await prisma.creditPurchase.findMany({
      where: { userId, deletedAt: null },
      orderBy: { firstDueDate: 'desc' },
    })
    const purchases = rows.map(compute)

    const active = purchases.filter((p) => p.remainingCount > 0)
    const summary = {
      monthlyCommitment: round2(active.reduce((s, p) => s + p.installmentAmount, 0)),
      totalRemaining: round2(purchases.reduce((s, p) => s + p.remainingAmount, 0)),
      activeCount: active.length,
    }
    return { purchases, summary }
  })

  // ─── POST / — cria uma compra parcelada ────────────────────────────────────
  app.post('/', async (request, reply) => {
    const userId = request.auth!.userId
    const parsed = createBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      })
    }

    const firstDueDate = new Date(parsed.data.firstDueDate)
    if (Number.isNaN(firstDueDate.getTime())) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Data inválida' } })
    }

    const row = await prisma.creditPurchase.create({
      data: {
        userId,
        description: parsed.data.description.trim(),
        totalAmount: parsed.data.totalAmount,
        installments: parsed.data.installments,
        firstDueDate,
        card: parsed.data.card?.trim() || null,
      },
    })
    return reply.code(201).send({ purchase: compute(row) })
  })

  // ─── DELETE /:id — soft-delete ─────────────────────────────────────────────
  app.delete('/:id', async (request, reply) => {
    const userId = request.auth!.userId
    const { id } = request.params as { id: string }
    const found = await prisma.creditPurchase.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true },
    })
    if (!found) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Compra não encontrada' } })
    }
    await prisma.creditPurchase.update({ where: { id }, data: { deletedAt: new Date() } })
    return reply.code(204).send()
  })
}
