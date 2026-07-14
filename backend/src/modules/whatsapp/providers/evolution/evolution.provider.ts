import axios, { type AxiosInstance } from 'axios'
import type { IWhatsAppProvider, SendTextResult } from '../whatsapp.provider.interface.js'
import type { NormalizedMessage, MessageProvider } from '../../types/normalized-message.type.js'
import type { EvolutionWebhookBody } from './evolution.types.js'
import { normalizeEvolutionWebhook } from './evolution.normalizer.js'
import { verifyHmacSignature, secretsMatch } from '@shared/utils/crypto.util.js'
import { logger } from '@config/logger.js'

// =============================================================================
// FinIA — EvolutionProvider
// =============================================================================
//
// Implementação de IWhatsAppProvider para a Evolution API.
//
// Suposições documentadas (Evolution API v2):
//   - Envio de texto: POST {baseUrl}/message/sendText/{instance}
//                     headers: { apikey }, body: { number, text }
//                     `number` em dígitos puros (sem '+').
//   - Webhook HMAC: a assinatura chega no header e é o HMAC-SHA256 do corpo
//                   bruto usando EVOLUTION_WEBHOOK_SECRET. (A entrega da
//                   assinatura depende da configuração do webhook na Evolution;
//                   ver whatsapp.controller.ts.)
//
// =============================================================================

export interface EvolutionConfig {
  baseUrl: string
  apiKey: string
  instance: string
  webhookSecret: string
}

export class EvolutionProvider implements IWhatsAppProvider {
  readonly name: MessageProvider = 'evolution'

  private readonly http: AxiosInstance
  private readonly instance: string
  private readonly webhookSecret: string

  constructor(config: EvolutionConfig) {
    this.instance = config.instance
    this.webhookSecret = config.webhookSecret

    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: 10_000,
      headers: {
        apikey: config.apiKey,
        'Content-Type': 'application/json',
      },
    })
  }

  verifySignature(
    rawBody: string | Buffer,
    signature: string | undefined,
    token?: string | undefined,
  ): boolean {
    // Caminho Evolution: token estático no header (configurado no webhook da
    // instância). Comparação em tempo constante.
    if (token && secretsMatch(token, this.webhookSecret)) return true
    // Caminho HMAC (Meta Cloud API ou um proxy que assine o corpo — futuro).
    if (signature) return verifyHmacSignature(rawBody, signature, this.webhookSecret)
    return false
  }

  parseWebhook(payload: unknown): NormalizedMessage | null {
    // O payload já foi parseado de JSON pelo Fastify; tipamos defensivamente.
    return normalizeEvolutionWebhook(payload as EvolutionWebhookBody)
  }

  async sendText(toE164: string, text: string): Promise<SendTextResult> {
    // Evolution espera o número em dígitos puros (sem '+').
    const number = toE164.replace(/\D/g, '')

    try {
      const response = await this.http.post(`/message/sendText/${this.instance}`, {
        number,
        text,
      })

      // A resposta de sucesso normalmente inclui key.id da mensagem criada.
      const providerMessageId =
        (response.data as { key?: { id?: string } } | undefined)?.key?.id ?? null

      return { success: true, providerMessageId }
    } catch (error) {
      // Não relança: o NotificationWorker decide sobre retry pela fila.
      logger.error(
        { err: error, to: number },
        'Evolution: falha ao enviar mensagem de texto',
      )
      return { success: false, providerMessageId: null }
    }
  }
}
