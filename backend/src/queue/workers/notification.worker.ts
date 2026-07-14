import { Worker } from 'bullmq'
import { QUEUE_NAMES } from '@config/constants.js'
import { logger } from '@config/logger.js'
import { defaultWorkerOptions } from '../queue.config.js'
import type { NotificationJobData } from '../jobs/notification.job.js'
import { getWhatsAppProvider } from '@modules/whatsapp/whatsapp.module.js'

// =============================================================================
// FinIA — Notification Worker
// =============================================================================
//
// Consome a fila notification.outbound e envia a mensagem via provider de
// WhatsApp. Se o envio falhar (success=false), lança para acionar o retry
// automático da fila — não perdemos confirmações por um blip na API.
//
// =============================================================================

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION_OUTBOUND,
    async (job) => {
      const { to, text } = job.data
      const result = await getWhatsAppProvider().sendText(to, text)
      if (!result.success) {
        throw new Error(`Falha ao enviar mensagem para ${to} — reagendando`)
      }
    },
    defaultWorkerOptions,
  )

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, attempts: job?.attemptsMade, err },
      'notification.worker: job falhou',
    )
  })

  worker.on('error', (err) => {
    logger.error({ err }, 'notification.worker: erro do worker')
  })

  logger.info('Notification worker iniciado')
  return worker
}
