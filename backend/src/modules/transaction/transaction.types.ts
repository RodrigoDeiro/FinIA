import type { TransactionType, TransactionSource, ParseMethod } from '@prisma/client'

// =============================================================================
// FinIA — Tipos do módulo Transaction
// =============================================================================

/**
 * Dados para criar uma transação. accountId e categoryId são opcionais aqui:
 * o service resolve a conta padrão do usuário e a categoria de fallback
 * ("outros") quando não informados.
 */
export interface CreateTransactionInput {
  userId: string

  type: TransactionType
  /** Valor SEMPRE positivo (o sinal vem do type) */
  amount: number
  date: Date

  description?: string | null
  merchantName?: string | null
  originalText?: string | null

  /** Categoria; se ausente, resolve para a categoria de fallback */
  categoryId?: string | null
  /** Conta; se ausente, usa a conta padrão do usuário */
  accountId?: string

  currency?: string
  source?: TransactionSource
  parseMethod?: ParseMethod
  /** Confiança do parser (0–1) quando aplicável */
  parseConfidence?: number | null
  needsReview?: boolean
}
