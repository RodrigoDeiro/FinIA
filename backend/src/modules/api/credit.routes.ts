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

const round2 = (n: number): number => Math.round(n * 100) / 100

function addMonths(date: Date, n: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

function compute(cp: CreditPurchase) {
  const total = Number(cp.totalAmount)
  const installmentAmount = round2(total / cp.installments)

  // Parcelas pagas: controle MANUAL (o usuário marca com "Paguei").
  const paidCount = Math.max(0, Math.min(cp.installments, cp.paidInstallments))
  const remainingCount = cp.installments - paidCount

  // Data da próxima parcela: 1ª parcela = firstDueDate (mês 0); a parcela
  // (paidCount+1) cai `paidCount` meses depois. Null se já quitada.
  const nextDueDate = remainingCount > 0 ? addMonths(cp.firstDueDate, paidCount) : null

  const paidAmount = remainingCount === 0 ? total : round2(paidCount * installmentAmount)
  const remainingAmount = remainingCount === 0 ? 0 : round2(total - paidAmount)

  return {
    id: cp.id,
    description: cp.description,
    card: cp.card,
    totalAmount: total,
    installments: cp.installments,
    firstDueDate: cp.firstDueDate,
    nextDueDate,
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

  // ─── POST /:id/pay | /:id/unpay — marca/desfaz uma parcela paga ─────────────
  async function adjustPaid(id: string, userId: string, delta: number) {
    const cp = await prisma.creditPurchase.findFirst({ where: { id, userId, deletedAt: null } })
    if (!cp) return null
    const next = Math.max(0, Math.min(cp.installments, cp.paidInstallments + delta))
    const updated = await prisma.creditPurchase.update({
      where: { id },
      data: { paidInstallments: next },
    })
    return compute(updated)
  }

  app.post('/:id/pay', async (request, reply) => {
    const { id } = request.params as { id: string }
    const purchase = await adjustPaid(id, request.auth!.userId, 1)
    if (!purchase) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Compra não encontrada' } })
    return reply.code(200).send({ purchase })
  })

  app.post('/:id/unpay', async (request, reply) => {
    const { id } = request.params as { id: string }
    const purchase = await adjustPaid(id, request.auth!.userId, -1)
    if (!purchase) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Compra não encontrada' } })
    return reply.code(200).send({ purchase })
  })
}
