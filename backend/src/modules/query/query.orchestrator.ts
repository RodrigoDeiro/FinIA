import type { User } from '@prisma/client'
import { getSystemCategories } from '@modules/ai/category.resolver.js'
import { isAiConfigured } from '@modules/ai/anthropic.client.js'
import { buildFinancialSnapshot } from '@modules/ai/context.builder.js'
import { getExchanges } from '@modules/ai/conversation.memory.js'
import { answerQueryWithAI } from '@modules/ai/ai.query.responder.js'
import { parseQueryDeterministic } from './deterministic/deterministic-query.parser.js'
import { executeQuery } from './query.service.js'
import { queryFallbackTemplate } from './query.templates.js'

// =============================================================================
// FinIA — Query Orchestrator
// =============================================================================
//
// Fluxo 7.2 do ARCHITECTURE ("Parse first, ask Claude never"):
//
//   1. DeterministicQueryParser tenta mapear métrica + período + categoria
//      → SQL pré-definido, sem Claude (~70% das consultas).
//   2. Consulta complexa → Claude (Haiku) responde sobre o snapshot financeiro
//      (Camada 2) + memória da conversa (Camada 1).
//   3. IA desativada/falhou → resposta de fallback com exemplos.
//
// =============================================================================

export async function orchestrateFinancialQuery(text: string, user: User): Promise<string> {
  // 1. Caminho determinístico
  const { slugs } = await getSystemCategories()
  const deterministic = parseQueryDeterministic(text, user.timezone, slugs)
  if (deterministic) {
    return executeQuery(deterministic, user)
  }

  // 2. Consulta complexa → IA sobre dados agregados
  if (isAiConfigured()) {
    const [snapshot, conversation] = await Promise.all([
      buildFinancialSnapshot(user.id, user.timezone, user.currency),
      getExchanges(user.id),
    ])
    const aiAnswer = await answerQueryWithAI(text, snapshot, conversation)
    if (aiAnswer) return aiAnswer
  }

  // 3. Fallback
  return queryFallbackTemplate()
}
