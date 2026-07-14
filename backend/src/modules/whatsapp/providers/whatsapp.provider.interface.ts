import type {
  NormalizedMessage,
  MessageProvider,
} from '../types/normalized-message.type.js'

// =============================================================================
// FinIA — IWhatsAppProvider
// =============================================================================
//
// Contrato que desacopla o resto do sistema do provider concreto de WhatsApp.
// Hoje há a implementação Evolution; amanhã uma Meta Cloud API pode entrar
// trocando apenas a fábrica no whatsapp.module.ts — nenhum outro arquivo muda.
//
// =============================================================================

/** Resultado do envio de uma mensagem de texto. */
export interface SendTextResult {
  success: boolean
  /** ID atribuído pelo provider à mensagem enviada (se retornado) */
  providerMessageId: string | null
}

export interface IWhatsAppProvider {
  /** Identificador do provider ('evolution' | 'meta') */
  readonly name: MessageProvider

  /**
   * Autentica o webhook. Aceita assinatura HMAC (`signature`) sobre o corpo
   * bruto OU um token estático (`token`) enviado nos headers pelo provider
   * (a Evolution não gera HMAC). Retorna false se nenhum conferir.
   */
  verifySignature(
    rawBody: string | Buffer,
    signature: string | undefined,
    token?: string | undefined,
  ): boolean

  /**
   * Converte o payload de webhook do provider em uma NormalizedMessage.
   * Retorna null quando o evento não é uma mensagem processável (ex: status
   * de entrega, eventos de conexão, tipos não suportados).
   */
  parseWebhook(payload: unknown): NormalizedMessage | null

  /**
   * Envia uma mensagem de texto para um número em E.164.
   * Não lança em falha de negócio: retorna success=false para o worker decidir
   * sobre retry. Lança apenas em erros irrecuperáveis de configuração.
   */
  sendText(toE164: string, text: string): Promise<SendTextResult>
}
