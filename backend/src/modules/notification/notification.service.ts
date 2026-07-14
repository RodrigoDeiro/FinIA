import { notificationQueue } from '@queue/queues.js'
import { NOTIFICATION_JOB_NAME } from '@queue/jobs/notification.job.js'

// =============================================================================
// FinIA — Notification Service (produtor)
// =============================================================================
//
// Enfileira mensagens de saída em vez de enviá-las direto. Assim, uma
// instabilidade na API do WhatsApp dispara o retry automático da fila sem
// bloquear o pipeline de processamento da mensagem recebida.
//
// O envio efetivo acontece no NotificationWorker (consumidor).
//
// =============================================================================

export async function sendText(to: string, text: string, userId?: string): Promise<void> {
  await notificationQueue.add(NOTIFICATION_JOB_NAME, { to, text, userId })
}
