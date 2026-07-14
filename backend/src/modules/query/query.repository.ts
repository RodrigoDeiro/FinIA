import type { TransactionType } from '@prisma/client'
import { prisma } from '@database/prisma.js'
import { round2 } from '@shared/utils/currency.util.js'

// =============================================================================
// FinIA — Query Repository
// =============================================================================
//
// Agregações usadas pelas consultas ("quanto gastei", "resumo", etc.) e pelo
// snapshot financeiro da IA. Só leitura; valores Decimal do Prisma são
// convertidos para number (2 casas) na borda.
//
// Todas as queries filtram deletedAt: null (soft delete).
//
// =============================================================================

interface PeriodFilter {
  start: Date
  end: Date
}

/** Soma de `amount` por tipo no período (opcionalmente filtrada por categoria). */
export async function sumAmount(
  userId: string,
  type: TransactionType,
  { start, end }: PeriodFilter,
  categoryId?: string,
): Promise<number> {
  const result = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      userId,
      type,
      deletedAt: null,
      date: { gte: start, lte: end },
      ...(categoryId ? { categoryId } : {}),
    },
  })
  return round2(Number(result._sum.amount ?? 0))
}

/** Total de transações do usuário no período. */
export async function countTransactions(
  userId: string,
  { start, end }: PeriodFilter,
): Promise<number> {
  return prisma.transaction.count({
    where: { userId, deletedAt: null, date: { gte: start, lte: end } },
  })
}

export interface CategoryTotal {
  categoryName: string
  total: number
}

/** Gastos agrupados por categoria (maiores primeiro). */
export async function expenseBreakdown(
  userId: string,
  { start, end }: PeriodFilter,
  limit = 5,
): Promise<CategoryTotal[]> {
  const groups = await prisma.transaction.groupBy({
    by: ['categoryId'],
    _sum: { amount: true },
    where: {
      userId,
      type: 'EXPENSE',
      deletedAt: null,
      date: { gte: start, lte: end },
    },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  })

  if (groups.length === 0) return []

  const categories = await prisma.category.findMany({
    where: { id: { in: groups.map((g) => g.categoryId) } },
    select: { id: true, name: true },
  })
  const nameById = new Map(categories.map((c) => [c.id, c.name]))

  return groups.map((g) => ({
    categoryName: nameById.get(g.categoryId) ?? 'Outros',
    total: round2(Number(g._sum.amount ?? 0)),
  }))
}

export interface MerchantTotal {
  merchantName: string
  total: number
}

/** Gastos agrupados por estabelecimento (maiores primeiro). */
export async function topMerchants(
  userId: string,
  { start, end }: PeriodFilter,
  limit = 5,
): Promise<MerchantTotal[]> {
  const groups = await prisma.transaction.groupBy({
    by: ['merchantName'],
    _sum: { amount: true },
    where: {
      userId,
      type: 'EXPENSE',
      merchantName: { not: null },
      deletedAt: null,
      date: { gte: start, lte: end },
    },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  })
  return groups
    .filter((g) => g.merchantName !== null)
    .map((g) => ({ merchantName: g.merchantName!, total: round2(Number(g._sum.amount ?? 0)) }))
}

/** Maior gasto individual do período (detecção de anomalia). */
export async function largestExpense(
  userId: string,
  { start, end }: PeriodFilter,
): Promise<{ amount: number; merchantName: string | null; description: string | null } | null> {
  const tx = await prisma.transaction.findFirst({
    where: { userId, type: 'EXPENSE', deletedAt: null, date: { gte: start, lte: end } },
    orderBy: { amount: 'desc' },
    select: { amount: true, merchantName: true, description: true },
  })
  return tx
    ? { amount: round2(Number(tx.amount)), merchantName: tx.merchantName, description: tx.description }
    : null
}

/** Todas as transações do período (relatórios) — cap para não explodir memória. */
export async function transactionsInPeriod(
  userId: string,
  { start, end }: PeriodFilter,
  limit = 500,
): Promise<RecentTransaction[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId, deletedAt: null, date: { gte: start, lte: end } },
    orderBy: { date: 'desc' },
    take: limit,
    select: {
      date: true,
      type: true,
      amount: true,
      merchantName: true,
      description: true,
      category: { select: { name: true } },
    },
  })
  return rows.map((r) => ({
    date: r.date,
    type: r.type,
    amount: round2(Number(r.amount)),
    merchantName: r.merchantName,
    categoryName: r.category.name,
    description: r.description,
  }))
}

export interface RecentTransaction {
  date: Date
  type: TransactionType
  amount: number
  merchantName: string | null
  categoryName: string
  description: string | null
}

/** Últimas N transações do usuário (para o snapshot da IA). */
export async function recentTransactions(
  userId: string,
  limit = 10,
): Promise<RecentTransaction[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId, deletedAt: null },
    orderBy: { date: 'desc' },
    take: limit,
    select: {
      date: true,
      type: true,
      amount: true,
      merchantName: true,
      description: true,
      category: { select: { name: true } },
    },
  })

  return rows.map((r) => ({
    date: r.date,
    type: r.type,
    amount: round2(Number(r.amount)),
    merchantName: r.merchantName,
    categoryName: r.category.name,
    description: r.description,
  }))
}
