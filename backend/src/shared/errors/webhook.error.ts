import { AppError } from './app.error.js'

// =============================================================================
// FinIA — Erro de Webhook
// =============================================================================
//
// Lançado durante o processamento de webhooks do WhatsApp:
//   - assinatura HMAC inválida (possível requisição forjada)
//   - payload malformado vindo do provider
//
// statusCode 401 para assinatura inválida (não autorizado). O controller
// decide o status final; o código 'WEBHOOK_ERROR' permite distinguir nos logs.
//
// IMPORTANTE: nunca devolver detalhes ao remetente do webhook — uma resposta
// detalhada ajudaria um atacante a forjar assinaturas. O details fica só no log.
//
// =============================================================================

export class WebhookError extends AppError {
  constructor(message = 'Webhook inválido', statusCode = 401, details?: unknown) {
    super(message, statusCode, 'WEBHOOK_ERROR', true, details)
  }
}
