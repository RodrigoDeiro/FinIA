// =============================================================================
// FinIA — Job: notification.outbound
// =============================================================================
//
// Payload enfileirado quando o sistema precisa enviar uma mensagem de volta ao
// usuário (confirmação de transação, boas-vindas, ajuda, erro). O
// NotificationWorker consome e envia via provider de WhatsApp.
//
// Enfileirar (em vez de enviar direto) garante retry automático se a API do
// WhatsApp estiver instável, sem bloquear o pipeline de processamento.
//
// =============================================================================

/** Nome lógico do job dentro da fila notification.outbound */
export const NOTIFICATION_JOB_NAME = 'send-text'

export interface NotificationJobData {
  /** Destinatário em E.164 (ex: '+5511999999999') */
  to: string

  /** Texto a enviar (já formatado pelo template) */
  text: string

  /** Usuário associado, para correlação em logs (opcional) */
  userId?: string
}
