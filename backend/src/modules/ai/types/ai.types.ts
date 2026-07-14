import type { TransactionType } from '@prisma/client'

// =============================================================================
// FinIA — Tipos do módulo AI
// =============================================================================

/** Transação extraída pelo Claude (antes de mapear categoria → id). */
export interface AIExtractedTransaction {
  type: TransactionType
  /** Valor positivo em reais */
  amount: number
  merchantName: string | null
  /** Slug de categoria do sistema (ou null se nenhuma se aplica) */
  categorySlug: string | null
  description: string | null
  /** Confiança da IA de que isto é uma transação real (0–1) */
  confidence: number
}

/** Resultado do orquestrador de IA, pronto para o pipeline de transação. */
export interface AIParseResult {
  type: TransactionType
  amount: number
  date: Date
  merchantName: string | null
  categoryId: string | null
  description: string
  confidence: number
}
