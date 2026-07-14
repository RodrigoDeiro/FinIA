import { env } from '@config/env.js'
import { logger } from '@config/logger.js'
import { connectDatabase, disconnectDatabase } from '@database/prisma.js'
import { connectRedis, disconnectRedis } from '@cache/redis.js'
import { createMessageWorker } from '@queue/workers/message.worker.js'
import { createNotificationWorker } from '@queue/workers/notification.worker.js'
import { createInsightWorker, scheduleWeeklyInsights } from '@queue/workers/insight.worker.js'
import { createReportWorker } from '@queue/workers/report.worker.js'
import { initBudgetWatcher } from '@modules/budget/budget.watcher.js'
import { closeQueues } from '@queue/queues.js'
import { buildApp } from './app.js'

// =============================================================================
// FinIA — Entry point
// =============================================================================
//
// Sequência de boot:
//   1. Conecta Postgres e Redis (fail fast se indisponíveis).
//   2. Monta o app e registra módulos.
//   3. Inicia os workers (consumidores das filas).
//   4. Escuta a porta.
//   5. Registra graceful shutdown em SIGTERM/SIGINT: encerra na ordem
//      app → workers → filas → redis → banco, drenando o que estiver em curso.
//
// =============================================================================

async function start(): Promise<void> {
  await connectDatabase()
  await connectRedis()

  const app = await buildApp()

  const messageWorker = createMessageWorker()
  const notificationWorker = createNotificationWorker()
  const insightWorker = createInsightWorker()
  const reportWorker = createReportWorker()

  // Cron semanal de insights (idempotente) + alertas de orçamento por evento
  await scheduleWeeklyInsights()
  initBudgetWatcher()

  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  logger.info(`FinIA backend ouvindo em http://localhost:${env.PORT}`)

  let shuttingDown = false
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'Encerrando graciosamente...')

    try {
      await app.close()
      await Promise.all([
        messageWorker.close(),
        notificationWorker.close(),
        insightWorker.close(),
        reportWorker.close(),
      ])
      await closeQueues()
      await disconnectRedis()
      await disconnectDatabase()
      logger.info('Shutdown concluído')
      process.exit(0)
    } catch (err) {
      logger.error({ err }, 'Erro durante o shutdown')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

start().catch((err) => {
  logger.error({ err }, 'Falha fatal no boot do servidor')
  process.exit(1)
})
