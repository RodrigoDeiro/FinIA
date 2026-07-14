import { Prisma, type User } from '@prisma/client'
import { logger } from '@config/logger.js'
import * as userRepository from './user.repository.js'

// =============================================================================
// FinIA — User Service
// =============================================================================
//
// Regra central: "primeira mensagem cria o usuário" (phone-first identity).
// findOrCreateByPhone é idempotente e seguro contra corrida: se duas mensagens
// do mesmo número chegarem quase simultaneamente, o índice único em
// phoneNumber garante que só uma criação vence; a outra cai no catch de P2002
// e relê o usuário já criado.
//
// =============================================================================

export async function findOrCreateByPhone(phoneNumber: string): Promise<User> {
  const existing = await userRepository.findByPhone(phoneNumber)
  if (existing) return existing

  try {
    const created = await userRepository.createWithDefaultAccount(phoneNumber)
    logger.info({ userId: created.id }, 'Novo usuário criado (onboarding)')
    return created
  } catch (error) {
    // P2002 = violação de unique constraint → corrida: outro request já criou.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await userRepository.findByPhone(phoneNumber)
      if (raced) return raced
    }
    throw error
  }
}
