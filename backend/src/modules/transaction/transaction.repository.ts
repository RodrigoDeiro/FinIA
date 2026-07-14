import type { Account, Prisma, Transaction } from '@prisma/client'
import { prisma } from '@database/prisma.js'
import { FALLBACK_CATEGORY_SLUG } from '@config/constants.js'

// =============================================================================
// FinIA — Transaction Repository
// =============================================================================
//
// Queries de transação e seus pré-requisitos (conta padrão, categoria de
// fallback). Sem regra de negócio — só acesso a dados.
//
// =============================================================================

/** Conta padrão do usuário (isDefault). Fallback: a conta mais antiga ativa. */
export async function getDefaultAccount(userId: string): Promise<Account | null> {
  const preferred = await prisma.account.findFirst({
    where: { userId, isDefault: true, deletedAt: null },
  })
  if (preferred) return preferred

  return prisma.account.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })
}

// A categoria de fallback ("outros") é do sistema e imutável — cacheável em
// memória pelo tempo de vida do processo. Evita um SELECT por transação.
let cachedFallbackCategoryId: string | null = null

/** Id da categoria de fallback "outros" (SYSTEM). Lança se o seed não rodou. */
export async function getFallbackCategoryId(): Promise<string> {
  if (cachedFallbackCategoryId) return cachedFallbackCategoryId

  const category = await prisma.category.findFirst({
    where: { userId: null, slug: FALLBACK_CATEGORY_SLUG },
    select: { id: true },
  })
  if (!category) {
    throw new Error(
      `Categoria de fallback "${FALLBACK_CATEGORY_SLUG}" não encontrada. Rode: npm run db:seed`,
    )
  }

  cachedFallbackCategoryId = category.id
  return category.id
}

/** Insere uma transação. */
export async function create(data: Prisma.TransactionUncheckedCreateInput): Promise<Transaction> {
  return prisma.transaction.create({ data })
}
