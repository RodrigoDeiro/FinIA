import { round2 } from '@shared/utils/currency.util.js'
import { AI_MIN_CONFIDENCE } from '@config/constants.js'
import { extractDate } from '@modules/parse/deterministic/date.extractor.js'
import { isAiConfigured } from './anthropic.client.js'
import { extractTransactionWithAI } from './ai.transaction.parser.js'
import { getSystemCategories } from './category.resolver.js'
import type { AIParseResult } from './types/ai.types.js'

// =============================================================================
// FinIA — AI Orchestrator
// =============================================================================
//
// Ponto de entrada da IA para o pipeline. Híbrido por design:
//   - Claude extrai type/amount/merchant/categoria (o que é difícil).
//   - O date.extractor determinístico resolve a data (hoje/ontem/DD-MM) — barato
//     e confiável, não precisa gastar a IA com isso.
//
// Retorna null quando a IA está desativada, falha, ou ela própria reporta
// confiança baixa demais (provavelmente não é uma transação).
//
// =============================================================================

export interface AIParseOptions {
  timezone: string
}

export async function parseWithAI(
  text: string,
  opts: AIParseOptions,
): Promise<AIParseResult | null> {
  if (!isAiConfigured()) return null

  const { slugs, slugToId } = await getSystemCategories()

  const extracted = await extractTransactionWithAI(text, slugs)
  if (!extracted) return null

  // A IA achou que provavelmente NÃO é uma transação → não inventa registro.
  if (extracted.confidence < AI_MIN_CONFIDENCE) return null

  const date = extractDate(text, opts.timezone).date
  const categoryId = extracted.categorySlug
    ? (slugToId.get(extracted.categorySlug) ?? null)
    : null

  return {
    type: extracted.type,
    amount: round2(extracted.amount),
    date,
    merchantName: extracted.merchantName,
    categoryId,
    description: extracted.description ?? text.trim(),
    // Clamp em [0,1] — formato Decimal(3,2) do banco
    confidence: Math.min(1, Math.max(0, round2(extracted.confidence))),
  }
}
