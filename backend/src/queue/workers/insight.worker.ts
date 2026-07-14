import { Worker } from 'bullmq'
import { QUEUE_NAMES } from '@config/constants.js'
import { logger } from '@config/logger.js'
import { prisma } from '@database/prisma.js'
import { defaultWorkerOptions } from '../queue.config.js'
import { insightQueue } from '../queues.js'
import {
  INSIGHT_FANOUT_JOB_NAME,
  INSIGHT_JOB_NAME,
  type InsightJobData,
} from '../jobs/insight.job.js'
import { runInsightEngine } from '@modules/insight/insight.engine.js'

// =============================================================================
// FinIA — Insight Worker
// =============================================================================
//
// Consome insight.generator:
//   - job 'fanout' (cron semanal, segunda 8h): enumera usuários ativos
//     (movimentação nos últimos 45 dias) e enfileira um 'generate' por usuário.
//   - job 'generate': roda o InsightEngine para o usuário.
//
// =============================================================================

const ACTIVE_WINDOW_DAYS = 45

async function fanout(): Promise<void> {
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000)
  const activeUsers = await prisma.transaction.findMany({
    where: { deletedAt: null, date: { gte: since } },
    distinct: ['userId'],
    select: { userId: true },
  })

  for (const { userId } of activeUsers) {
    await insightQueue.add(INSIGHT_JOB_NAME, { userId, trigger: 'cron' } satisfies InsightJobData)
  }
  logger.info({ users: activeUsers.length }, 'Insight fanout: jobs enfileirados')
}

export function createInsightWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.INSIGHT_GENERATOR,
    async (job) => {
      if (job.name === INSIGHT_FANOUT_JOB_NAME) {
        await fanout()
        return
      }
      const { userId, trigger } = job.data as InsightJobData
      await runInsightEngine(userId, trigger)
    },
    defaultWorkerOptions,
  )

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'insight.worker: job falhou')
  })
  worker.on('error', (err) => {
    logger.error({ err }, 'insight.worker: erro do worker')
  })

  logger.info('Insight worker iniciado')
  return worker
}

/**
 * Agenda o cron semanal (§7.3: segunda-feira 8h, fuso de SP).
 * upsertJobScheduler é idempotente — reinícios não duplicam o agendamento.
 */
export async function scheduleWeeklyInsights(): Promise<void> {
  await insightQueue.upsertJobScheduler(
    'weekly-insights',
    { pattern: '0 8 * * 1', tz: 'America/Sao_Paulo' },
    { name: INSIGHT_FANOUT_JOB_NAME, data: {} },
  )
  logger.info('Cron semanal de insights agendado (segunda 8h America/Sao_Paulo)')
}
