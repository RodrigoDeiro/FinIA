import type { TransactionType } from '@prisma/client'
import { prisma } from '@database/prisma.js'
import { cacheService } from '@cache/cache.service.js'
import { REDIS_KEYS, TTL } from '@config/constants.js'

// =============================================================================
// FinIA — MerchantDB
// =============================================================================
//
// Carrega a base de merchants do Postgres e cacheia no Redis (TTL 1h) para
// que o parser não bata no banco a cada mensagem.
//
// Lookup do parser: merchants do usuário primeiro, depois globais.
//   - global (userId = null): seed (~60 marcas conhecidas)
//   - user   (userId != null): aprendidos por correção (Sprint 2)
//
// =============================================================================

/** Forma enxuta de um merchant para uso no parser (sem timestamps). */
export interface MerchantRecord {
  id: string
  name: string
  slug: string
  aliases: string[]
  categoryId: string
  defaultType: TransactionType
}

const SELECT = {
  id: true,
  name: true,
  slug: true,
  aliases: true,
  categoryId: true,
  defaultType: true,
} as const

/** Merchants globais (compartilhados). Cacheados sob uma única chave. */
export async function getGlobalMerchants(): Promise<MerchantRecord[]> {
  return cacheService.getOrSet(REDIS_KEYS.merchantDbGlobal, TTL.MERCHANT_DB, async () => {
    return prisma.merchant.findMany({
      where: { userId: null },
      select: SELECT,
    })
  })
}

/** Merchants aprendidos por um usuário específico. */
export async function getUserMerchants(userId: string): Promise<MerchantRecord[]> {
  return cacheService.getOrSet(REDIS_KEYS.merchantDbUser(userId), TTL.MERCHANT_DB, async () => {
    return prisma.merchant.findMany({
      where: { userId },
      select: SELECT,
    })
  })
}

/** Conjunto completo para o parser: { user, global }. */
export async function getMerchantsForUser(
  userId: string,
): Promise<{ user: MerchantRecord[]; global: MerchantRecord[] }> {
  const [user, global] = await Promise.all([getUserMerchants(userId), getGlobalMerchants()])
  return { user, global }
}

/** Invalida o cache global (após reseed/atualização das marcas). */
export async function invalidateGlobalMerchants(): Promise<void> {
  await cacheService.del(REDIS_KEYS.merchantDbGlobal)
}

/** Invalida o cache de um usuário (após ele ensinar um novo merchant). */
export async function invalidateUserMerchants(userId: string): Promise<void> {
  await cacheService.del(REDIS_KEYS.merchantDbUser(userId))
}
