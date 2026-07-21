import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@database/prisma.js'
import { tenantPrisma } from '@database/tenant.prisma.js'
import { buildFinancialSnapshot } from '@modules/ai/context.builder.js'
import { normalizeText } from '@shared/utils/text.util.js'
import { env } from '@config/env.js'
import { createTelegramLinkCode } from '@modules/telegram/telegram.link.service.js'

const createCategoryBody = z.object({ name: z.string().trim().min(1).max(60) })

function toSlug(name: string): string {
  const slug = normalizeText(name).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  return slug.slice(0, 60) || 'categoria'
}

// =============================================================================
// FinIA — Rotas de recursos (/api/v1)
// =============================================================================
//
//   GET /me          perfil do usuário logado + contas
//   GET /accounts    contas do usuário
//   GET /categories  categorias do sistema + do usuário (dual-mode)
//   GET /summary     resumo financeiro do mês (mesmo snapshot da IA — cacheado)
//
// =============================================================================

export async function resourceRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET /me ────────────────────────────────────────────────────────────────
  app.get('/me', async (request) => {
    const userId = request.auth!.userId
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        email: true,
        timezone: true,
        currency: true,
        language: true,
        createdAt: true,
      },
    })
    const accounts = await tenantPrisma.account.findMany({ orderBy: { createdAt: 'asc' } })
    return {
      user,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        institution: a.institution,
        isDefault: a.isDefault,
      })),
    }
  })

  // ─── GET /accounts ──────────────────────────────────────────────────────────
  app.get('/accounts', async () => {
    const accounts = await tenantPrisma.account.findMany({ orderBy: { createdAt: 'asc' } })
    return {
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        institution: a.institution,
        color: a.color,
        isDefault: a.isDefault,
      })),
    }
  })

  // ─── GET /categories — dual-mode (sistema + usuário) ───────────────────────
  // Usa o client BASE de propósito: categorias do sistema têm userId=null e o
  // tenantPrisma as esconderia. O filtro OR explícito é a regra dual-mode.
  app.get('/categories', async (request) => {
    const userId = request.auth!.userId
    const categories = await prisma.category.findMany({
      where: { deletedAt: null, OR: [{ userId: null }, { userId }] },
      orderBy: [{ origin: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
        origin: true,
        applicableTo: true,
      },
    })
    return { categories }
  })

  // ─── POST /categories — cria uma categoria do usuário ──────────────────────
  app.post('/categories', async (request, reply) => {
    const userId = request.auth!.userId
    const parsed = createCategoryBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Informe um nome válido' } })
    }
    const name = parsed.data.name.trim()
    try {
      const category = await prisma.category.create({
        data: { userId, origin: 'USER', name, slug: toSlug(name) },
        select: { id: true, name: true, slug: true, icon: true, color: true, origin: true, applicableTo: true },
      })
      return reply.code(201).send({ category })
    } catch {
      // Colisão de unique [userId, slug]
      return reply.code(409).send({ error: { code: 'CATEGORY_EXISTS', message: 'Você já tem uma categoria com esse nome' } })
    }
  })

  // ─── DELETE /categories/:id — remove (soft) uma categoria do usuário ────────
  // Só categorias do PRÓPRIO usuário (origin USER). As do sistema são fixas.
  app.delete('/categories/:id', async (request, reply) => {
    const userId = request.auth!.userId
    const { id } = request.params as { id: string }
    const cat = await prisma.category.findFirst({
      where: { id, userId, origin: 'USER', deletedAt: null },
      select: { id: true },
    })
    if (!cat) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Categoria não encontrada' } })
    }
    await prisma.category.update({ where: { id }, data: { deletedAt: new Date() } })
    return reply.code(204).send()
  })

  // ─── Telegram — status / conectar / desconectar ────────────────────────────
  app.get('/telegram', async (request) => {
    const user = await prisma.user.findFirst({
      where: { id: request.auth!.userId },
      select: { telegramChatId: true },
    })
    return {
      available: Boolean(env.TELEGRAM_BOT_USERNAME),
      connected: Boolean(user?.telegramChatId),
    }
  })

  app.post('/telegram/connect', async (request, reply) => {
    const username = env.TELEGRAM_BOT_USERNAME
    if (!username) {
      return reply.code(503).send({ error: { code: 'TELEGRAM_OFF', message: 'Telegram não está configurado' } })
    }
    const code = await createTelegramLinkCode(request.auth!.userId)
    return { url: `https://t.me/${username}?start=${code}` }
  })

  app.post('/telegram/disconnect', async (request) => {
    await prisma.user.update({
      where: { id: request.auth!.userId },
      data: { telegramChatId: null },
    })
    return { connected: false }
  })

  // ─── GET /summary — visão do mês para o dashboard ──────────────────────────
  app.get('/summary', async (request) => {
    const userId = request.auth!.userId
    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: { timezone: true, currency: true },
    })
    return buildFinancialSnapshot(userId, user!.timezone, user!.currency)
  })
}
