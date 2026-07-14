import { Queue } from 'bullmq'
import { QUEUE_NAMES } from '@config/constants.js'
import { defaultQueueOptions } from './queue.config.js'
import type { MessageJobData } from './jobs/message.job.js'
import type { NotificationJobData } from './jobs/notification.job.js'

// =============================================================================
// FinIA — Definição das Filas
// =============================================================================
//
// As 4 filas do sistema. No Sprint 1, apenas message.incoming e
// notification.outbound têm produtores/consumidores ativos; insight.generator
// e report.generator são criadas (aparecem no Bull Board) e passam a ser
// consumidas no Sprint 4. Criar a fila não custa nada além do registro no Redis.
//
// =============================================================================

/** Mensagens recebidas do WhatsApp, aguardando processamento. */
export const messageQueue = new Queue<MessageJobData>(
  QUEUE_NAMES.MESSAGE_INCOMING,
  defaultQueueOptions,
)

/** Mensagens a enviar de volta ao usuário (confirmações, ajuda, erros). */
export const notificationQueue = new Queue<NotificationJobData>(
  QUEUE_NAMES.NOTIFICATION_OUTBOUND,
  defaultQueueOptions,
)

/** Geração de insights semanais (Sprint 4). */
export const insightQueue = new Queue(QUEUE_NAMES.INSIGHT_GENERATOR, defaultQueueOptions)

/** Geração de relatórios sob demanda (Sprint 4). */
export const reportQueue = new Queue(QUEUE_NAMES.REPORT_GENERATOR, defaultQueueOptions)

/** Todas as filas — usado pelo Bull Board e pelo graceful shutdown. */
export const allQueues = [messageQueue, notificationQueue, insightQueue, reportQueue]

/**
 * Fecha todas as filas no graceful shutdown. Encerra as conexões do produtor
 * (os workers têm seu próprio close).
 */
export async function closeQueues(): Promise<void> {
  await Promise.all(allQueues.map((q) => q.close()))
}
