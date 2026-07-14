// =============================================================================
// FinIA — Tipos do Webhook da Evolution API
// =============================================================================
//
// Modela o evento `messages.upsert` da Evolution API (v2). Os campos são
// tipados como opcionais porque o payload varia conforme o tipo de mensagem
// (texto simples, texto estendido, imagem com legenda, etc.) e versão da API.
// O normalizer lida com a ausência de cada campo de forma defensiva.
//
// Referência: estrutura baseada no Baileys (motor do WhatsApp usado pela
// Evolution). NÃO assumimos campos além dos que efetivamente lemos.
//
// =============================================================================

/** Chave que identifica uma mensagem no WhatsApp */
export interface EvolutionMessageKey {
  /** JID do remetente/conversa (ex: '5511999999999@s.whatsapp.net' ou '...@g.us') */
  remoteJid?: string
  /** true se a mensagem foi enviada pela própria instância (echo) */
  fromMe?: boolean
  /** ID único da mensagem no provider */
  id?: string
}

/** Conteúdo da mensagem — apenas as variantes que sabemos extrair texto */
export interface EvolutionMessageContent {
  /** Texto simples */
  conversation?: string
  /** Texto "estendido" (com formatação, links, respostas) */
  extendedTextMessage?: { text?: string }
  /** Imagem (lemos a legenda como texto, se houver) */
  imageMessage?: { caption?: string; url?: string }
  /** Documento (lemos a legenda como texto, se houver) */
  documentMessage?: { caption?: string; url?: string; fileName?: string }
  /** Áudio (sem texto; tratado como tipo 'audio') */
  audioMessage?: { url?: string }
}

/** Dados de uma mensagem dentro do evento */
export interface EvolutionMessageData {
  key?: EvolutionMessageKey
  pushName?: string
  message?: EvolutionMessageContent
  /** Tipo reportado pela Evolution (ex: 'conversation', 'imageMessage') */
  messageType?: string
  /** Timestamp em segundos (epoch) atribuído pelo provider */
  messageTimestamp?: number | string
}

/** Corpo completo do webhook */
export interface EvolutionWebhookBody {
  /** Nome do evento (só processamos 'messages.upsert') */
  event?: string
  /** Instância que recebeu */
  instance?: string
  /**
   * Dados do evento. A Evolution pode enviar um objeto único ou um array
   * (lote). O normalizer aceita ambos.
   */
  data?: EvolutionMessageData | EvolutionMessageData[]
  /** Número da instância (destinatário), quando presente */
  sender?: string
}
