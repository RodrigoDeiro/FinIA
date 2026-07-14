import type { Transaction } from '@prisma/client'
import { logger } from '@config/logger.js'
import { cacheService } from '@cache/cache.service.js'
import { REDIS_KEYS, DEFAULT_CURRENCY } from '@config/constants.js'
import { NotFoundError } from '@shared/errors/index.js'
import { EVENTS, emitTransactionEvent } from '@shared/events/event.bus.js'
import * as txRepository from './transaction.repository.js'
import { validateTransaction } from './transaction.validator.js'
import type { CreateTransactionInput } from './transaction.types.js'

// =============================================================================
// FinIA — Transaction Service
// =============================================================================
//
// Cria uma transação a partir de dados já parseados:
//   1. Valida os campos essenciais (Zod) — lança ValidationError se inválido.
//   2. Resolve a conta padrão do usuário (404 se não houver).
//   3. Resolve a categoria (a do merchant ou o fallback "outros").
//   4. Persiste no Postgres.
//   5. Invalida o cache de resumo do usuário no Redis.
//
// (O evento "transaction.created" é apenas logado no Sprint 1; um event bus
//  real entra em Sprints futuros.)
//
// =============================================================================

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  // 1. Validação dos campos essenciais
  const valid = validateTransaction({
    amount: input.amount,
    type: input.type,
    date: input.date,
    description: input.description,
    merchantName: input.merchantName,
    originalText: input.originalText,
    currency: input.currency ?? DEFAULT_CURRENCY,
    parseConfidence: input.parseConfidence,
  })

  // 2. Conta de destino
  const accountId =
    input.accountId ?? (await txRepository.getDefaultAccount(input.userId))?.id
  if (!accountId) {
    throw new NotFoundError('Conta padrão do usuário', input.userId)
  }

  // 3. Categoria (a do merchant, ou o fallback "outros")
  const categoryId = input.categoryId ?? (await txRepository.getFallbackCategoryId())

  // 4. Persiste
  const transaction = await txRepository.create({
    userId: input.userId,
    accountId,
    categoryId,
    type: valid.type,
    amount: valid.amount,
    currency: valid.currency,
    date: valid.date,
    description: valid.description ?? null,
    merchantName: valid.merchantName ?? null,
    originalText: valid.originalText ?? null,
    source: input.source ?? 'WHATSAPP',
    parseMethod: input.parseMethod ?? 'DETERMINISTIC',
    parseConfidence: valid.parseConfidence ?? null,
    needsReview: input.needsReview ?? false,
  })

  // 5. Invalida cache do usuário (saldo/resumo passam a estar desatualizados)
  await cacheService.del(REDIS_KEYS.userCache(input.userId))

  logger.info(
    { userId: input.userId, transactionId: transaction.id, type: transaction.type },
    'transaction.created',
  )

  // Evento para o SSE (dashboard em tempo real — Sprint 3)
  emitTransactionEvent(EVENTS.TRANSACTION_CREATED, {
    userId: input.userId,
    transactionId: transaction.id,
    type: transaction.type,
    amount: valid.amount,
    merchantName: transaction.merchantName,
    categoryId: transaction.categoryId,
    date: transaction.date.toISOString(),
    needsReview: transaction.needsReview,
  })

  return transaction
}
