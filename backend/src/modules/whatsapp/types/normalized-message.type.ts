// =============================================================================
// FinIA — NormalizedMessage (formato interno)
// =============================================================================
//
// Tipo canônico de uma mensagem recebida, independente do provider.
// Evolution e Meta (futuro) normalizam seus payloads para ESTE formato antes
// de seguir no pipeline. Assim, todo o resto do sistema desconhece o provider
// (princípio "abstraction over implementation").
//
// =============================================================================

/** Provider de origem da mensagem */
export type MessageProvider = 'evolution' | 'meta'

/** Tipo de conteúdo da mensagem */
export type MessageContentType = 'text' | 'audio' | 'image' | 'document' | 'unknown'

export interface NormalizedMessage {
  /** Provider que entregou a mensagem */
  provider: MessageProvider

  /** ID da mensagem no provider — chave de idempotência */
  providerMessageId: string

  /** Remetente em E.164 já normalizado (ex: '+5511999999999') */
  from: string

  /** Número da instância que recebeu (E.164), quando disponível */
  to: string | null

  /** Tipo de conteúdo */
  type: MessageContentType

  /** Texto da mensagem (null para tipos não-texto sem legenda) */
  text: string | null

  /** URL de mídia (áudio/imagem/documento), quando aplicável */
  mediaUrl: string | null

  /** Momento em que o provider registrou a mensagem */
  timestamp: Date

  /** Mensagem enviada por nós mesmos (echo) — deve ser ignorada no pipeline */
  fromMe: boolean
}
