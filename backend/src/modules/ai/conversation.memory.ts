import { cacheService } from '@cache/cache.service.js'
import { REDIS_KEYS, TTL } from '@config/constants.js'
import { logger } from '@config/logger.js'

// =============================================================================
// FinIA — Conversation Memory (Camada 1)
// =============================================================================
//
// Memória curta da conversa (§4 do ARCHITECTURE): últimas trocas de mensagem
// por usuário, no Redis com TTL de 24h. Permite que a IA entenda follow-ups
// como "e no mês passado?" sem o usuário repetir o contexto.
//
// Best-effort por design: uma falha aqui degrada a qualidade do contexto,
// nunca o pipeline — por isso o try/catch com warn.
//
// =============================================================================

export interface ConversationExchange {
  /** Mensagem do usuário */
  user: string
  /** Resposta do FinIA */
  assistant: string
  /** ISO 8601 */
  at: string
}

const MAX_EXCHANGES = 5

export async function recordExchange(
  userId: string,
  userText: string,
  assistantText: string,
): Promise<void> {
  try {
    const key = REDIS_KEYS.conversation(userId)
    const existing = (await cacheService.get<ConversationExchange[]>(key)) ?? []
    existing.push({ user: userText, assistant: assistantText, at: new Date().toISOString() })
    await cacheService.set(key, existing.slice(-MAX_EXCHANGES), TTL.CONVERSATION)
  } catch (err) {
    logger.warn({ err, userId }, 'Conversa não registrada na memória (best-effort)')
  }
}

export async function getExchanges(userId: string): Promise<ConversationExchange[]> {
  try {
    return (await cacheService.get<ConversationExchange[]>(REDIS_KEYS.conversation(userId))) ?? []
  } catch (err) {
    logger.warn({ err, userId }, 'Falha ao ler memória de conversa (best-effort)')
    return []
  }
}
