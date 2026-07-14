import type {
  NormalizedMessage,
  MessageContentType,
} from '../../types/normalized-message.type.js'
import type {
  EvolutionWebhookBody,
  EvolutionMessageData,
  EvolutionMessageContent,
} from './evolution.types.js'
import { normalizePhone } from '@shared/utils/phone.util.js'

// =============================================================================
// FinIA — Normalizer da Evolution API
// =============================================================================
//
// Converte o payload `messages.upsert` da Evolution em NormalizedMessage.
// Defensivo por design: qualquer campo ausente ou inesperado resulta em null
// (mensagem ignorada) em vez de erro. Mensagens de grupo (@g.us) são ignoradas
// no Sprint 1 — o produto é 1:1 com o usuário.
//
// =============================================================================

/** Extrai o texto da mensagem conforme a variante de conteúdo. */
function extractText(message: EvolutionMessageContent | undefined): string | null {
  if (!message) return null
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.documentMessage?.caption ??
    null
  )
}

/** Mapeia o tipo da Evolution para o nosso MessageContentType. */
function mapContentType(message: EvolutionMessageContent | undefined): MessageContentType {
  if (!message) return 'unknown'
  if (message.conversation !== undefined || message.extendedTextMessage !== undefined) return 'text'
  if (message.imageMessage !== undefined) return 'image'
  if (message.documentMessage !== undefined) return 'document'
  if (message.audioMessage !== undefined) return 'audio'
  return 'unknown'
}

/** Converte messageTimestamp (segundos, number ou string) em Date. */
function toDate(timestamp: number | string | undefined): Date {
  if (timestamp === undefined) return new Date()
  const seconds = typeof timestamp === 'string' ? Number(timestamp) : timestamp
  if (!Number.isFinite(seconds)) return new Date()
  return new Date(seconds * 1000)
}

/** Normaliza um único registro de mensagem. `sender` é o número da instância (nível do corpo). */
function normalizeOne(data: EvolutionMessageData, sender: string | undefined): NormalizedMessage | null {
  const key = data.key
  if (!key?.id || !key.remoteJid) return null

  // Ignora grupos no Sprint 1 (produto é conversa direta com o usuário)
  if (key.remoteJid.includes('@g.us')) return null

  const from = normalizePhone(key.remoteJid)
  if (!from) return null

  const mediaUrl =
    data.message?.imageMessage?.url ??
    data.message?.documentMessage?.url ??
    data.message?.audioMessage?.url ??
    null

  return {
    provider: 'evolution',
    providerMessageId: key.id,
    from,
    to: sender ? normalizePhone(sender) : null,
    type: mapContentType(data.message),
    text: extractText(data.message),
    mediaUrl,
    timestamp: toDate(data.messageTimestamp),
    fromMe: key.fromMe === true,
  }
}

/**
 * Normaliza o webhook da Evolution. Aceita `data` como objeto único ou array
 * (lote); neste caso retorna a PRIMEIRA mensagem processável. Lotes maiores
 * que uma mensagem são raros em conversas 1:1; o restante, se houver, será
 * reentregue pela Evolution em eventos subsequentes.
 */
export function normalizeEvolutionWebhook(body: EvolutionWebhookBody): NormalizedMessage | null {
  // Tolerante ao formato do nome do evento: 'messages.upsert' (corpo) ou
  // 'MESSAGES_UPSERT' (subscrição) → normaliza para o mesmo.
  const event = (body.event ?? '').toLowerCase().replace(/_/g, '.')
  if (event !== 'messages.upsert') return null
  if (!body.data) return null

  const records = Array.isArray(body.data) ? body.data : [body.data]
  for (const record of records) {
    const normalized = normalizeOne(record, body.sender)
    if (normalized) return normalized
  }
  return null
}
