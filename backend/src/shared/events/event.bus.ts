import { EventEmitter } from 'node:events'
import type { TransactionType } from '@prisma/client'

// =============================================================================
// FinIA — Event Bus (in-process)
// =============================================================================
//
// Emissor de eventos de domínio dentro do processo. Consumido pelo endpoint
// SSE (/api/v1/events) para empurrar atualizações em tempo real ao dashboard.
//
// Escopo consciente: funciona em processo único (dev e single-node). Se o
// backend escalar horizontalmente, este bus vira um adapter para Redis
// pub/sub — a interface (emit/on tipados) permanece.
//
// =============================================================================

export const EVENTS = {
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_UPDATED: 'transaction.updated',
  TRANSACTION_DELETED: 'transaction.deleted',
} as const

export interface TransactionEventPayload {
  userId: string
  transactionId: string
  type: TransactionType
  amount: number
  merchantName: string | null
  categoryId: string
  date: string
  needsReview: boolean
}

class FiniaEventBus extends EventEmitter {}

export const eventBus = new FiniaEventBus()
// SSE: um listener por aba de dashboard aberta — o default (10) é baixo demais
eventBus.setMaxListeners(100)

export function emitTransactionEvent(
  event: (typeof EVENTS)[keyof typeof EVENTS],
  payload: TransactionEventPayload,
): void {
  eventBus.emit(event, payload)
}
