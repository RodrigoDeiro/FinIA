import { Worker } from 'bullmq'
import { QUEUE_NAMES } from '@config/constants.js'
import { logger } from '@config/logger.js'
import { defaultWorkerOptions } from '../queue.config.js'
import type { ReportJobData } from '../jobs/report.job.js'
import { generateReport } from '@modules/report/report.service.js'

// =============================================================================
// FinIA — Report Worker
// =============================================================================

export function createReportWorker(): Worker<ReportJobData> {
  const worker = new Worker<ReportJobData>(
    QUEUE_NAMES.REPORT_GENERATOR,
    async (job) => {
      await generateReport(job.data.reportId)
    },
    defaultWorkerOptions,
  )

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'report.worker: job falhou')
  })
  worker.on('error', (err) => {
    logger.error({ err }, 'report.worker: erro do worker')
  })

  logger.info('Report worker iniciado')
  return worker
}
