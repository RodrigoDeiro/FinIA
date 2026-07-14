import type { FastifyInstance } from 'fastify'
import { prisma } from '@database/prisma.js'
import { tenantPrisma } from '@database/tenant.prisma.js'
import { buildFinancialSnapshot } from '@modules/ai/context.builder.js'

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
