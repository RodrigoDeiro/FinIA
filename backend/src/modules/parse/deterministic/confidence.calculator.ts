import { round2 } from '@shared/utils/currency.util.js'
import type { ConfidenceComponents } from '../types/parse-result.type.js'

// =============================================================================
// FinIA — Confidence Calculator
// =============================================================================
//
// Score 0.00–1.00 por soma ponderada dos componentes extraídos. Os pesos foram
// calibrados para que:
//
//   - amount + descrição          ≈ 0.65 → salva com needsReview
//   - amount + merchant conhecido ≈ 0.80 → salva com needsReview
//   - amount + descrição + verbo  ≈ 0.85 → salva direto
//   - apenas um número solto      ≈ 0.45 → vai para a IA (ambíguo)
//
// amount é o componente essencial: sem valor, não há transação a registrar.
//
// =============================================================================

export const CONFIDENCE_WEIGHTS = {
  /** Valor monetário presente — sinal essencial */
  amount: 0.45,
  /** Há descrição (merchant ou texto útil além do número) */
  context: 0.2,
  /** Palavra-chave explícita determinou o tipo (gastei, recebi, investi...) */
  type: 0.2,
  /** Merchant reconhecido na base (sabemos a categoria) */
  merchant: 0.15,
} as const

export function calculateConfidence(c: ConfidenceComponents): number {
  let score = 0
  if (c.hasAmount) score += CONFIDENCE_WEIGHTS.amount
  if (c.hasContext) score += CONFIDENCE_WEIGHTS.context
  if (c.hasType) score += CONFIDENCE_WEIGHTS.type
  if (c.hasMerchant) score += CONFIDENCE_WEIGHTS.merchant

  // Clamp em [0, 1] e arredonda a 2 casas (formato Decimal(3,2) do banco)
  return Math.min(1, Math.max(0, round2(score)))
}
