import { Worker } from 'bullmq'
import { QUEUE_NAMES } from '@config/constants.js'
import { logger } from '@config/logger.js'
import { defaultWorkerOptions } from '../queue.config.js'
import type { MessageJobData } from '../jobs/message.job.js'
import { processIncomingMessage } from '@modules/message/message.processor.js'

// =============================================================================
// FinIA — Message Worker
// =============================================================================
//
// Consome a fila message.incoming e roda o pipeline completo. Erros lançados
// aqui fazem o BullMQ reagendar o job (attempts + backoff da queue.config).
//
// =============================================================================

export function createMessageWorker(): Worker<MessageJobData> {
  const worker = new Worker<MessageJobData>(
    QUEUE_NAMES.MESSAGE_INCOMING,
    async (job) => {
      await processIncomingMessage(job.data.normalized)
    },
    defaultWorkerOptions,
  )

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, attempts: job?.attemptsMade, err },
      'message.worker: job falhou',
    )
  })

  worker.on('error', (err) => {
    logger.error({ err }, 'message.worker: erro do worker')
  })

  logger.info('Message worker iniciado')
  return worker
}
