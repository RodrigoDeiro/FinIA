import { CONFIDENCE } from '@config/constants.js'
import { getMerchantsForUser } from './deterministic/merchant-db/merchant.db.js'
import { parseDeterministic } from './deterministic/deterministic.parser.js'
import type { ParseDecision, ParseOrchestratorResult } from './types/parse-result.type.js'

// =============================================================================
// FinIA — Parse Orchestrator
// =============================================================================
//
// Ponte entre o pipeline e o parser determinístico:
//   1. Carrega os merchants do usuário (cache Redis) + globais.
//   2. Roda o parser determinístico.
//   3. Decide o destino pela confiança:
//        >= 0.85           → auto_save     (salva direto)
//        [0.65, 0.85)      → needs_review  (salva com flag)
//        <  0.65           → ai_fallback    (IA — Sprint 2)
//
// =============================================================================

function decide(confidence: number): ParseDecision {
  if (confidence >= CONFIDENCE.AUTO_SAVE) return 'auto_save'
  if (confidence >= CONFIDENCE.REVIEW) return 'needs_review'
  return 'ai_fallback'
}

export interface OrchestrateOptions {
  userId: string
  timezone: string
}

export async function orchestrateParse(
  text: string,
  opts: OrchestrateOptions,
): Promise<ParseOrchestratorResult> {
  const { user, global } = await getMerchantsForUser(opts.userId)

  const parsed = parseDeterministic(text, {
    timezone: opts.timezone,
    userMerchants: user,
    globalMerchants: global,
  })

  return { decision: decide(parsed.confidence), parsed }
}
