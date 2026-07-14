import type { User } from '@prisma/client'
import { prisma } from '@database/prisma.js'
import { DEFAULT_ACCOUNT_NAME } from '@config/constants.js'
import type { UserWithAccounts } from './user.types.js'

// =============================================================================
// FinIA — User Repository
// =============================================================================
//
// Acesso a dados de usuário. Sem regra de negócio aqui — apenas queries.
// A camada de serviço (user.service.ts) orquestra o findOrCreate.
//
// =============================================================================

/** Busca um usuário ativo (não soft-deleted) pelo número E.164. */
export async function findByPhone(phoneNumber: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { phoneNumber, deletedAt: null },
  })
}

/**
 * Cria o usuário JÁ com a conta "Principal" padrão, em uma única operação
 * atômica (Prisma resolve o nested create numa transação). É o onboarding
 * disparado pela primeira mensagem do número.
 */
export async function createWithDefaultAccount(phoneNumber: string): Promise<UserWithAccounts> {
  return prisma.user.create({
    data: {
      phoneNumber,
      accounts: {
        create: {
          name: DEFAULT_ACCOUNT_NAME,
          type: 'CHECKING',
          isDefault: true,
        },
      },
    },
    include: { accounts: true },
  })
}
