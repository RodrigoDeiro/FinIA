import Anthropic from '@anthropic-ai/sdk'
import { env } from '@config/env.js'

// =============================================================================
// FinIA — Anthropic Client
// =============================================================================
//
// Singleton do SDK oficial. A chave vem de ANTHROPIC_API_KEY (validada como
// opcional no env global; a presença real é checada por isAiConfigured()).
//
// Se a chave não estiver configurada, a IA é simplesmente desativada e o
// pipeline degrada graciosamente (mensagens ambíguas recebem "não entendi"),
// sem derrubar o servidor — coerente com o princípio de desenvolvimento
// incremental do projeto.
//
// =============================================================================

let client: Anthropic | null = null

/** true se há uma chave da Anthropic configurada. */
export function isAiConfigured(): boolean {
  return typeof env.ANTHROPIC_API_KEY === 'string' && env.ANTHROPIC_API_KEY.length > 0
}

/** Retorna o client do Anthropic (lazy). Só chamar quando isAiConfigured(). */
export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  }
  return client
}
