import type { Report } from '@prisma/client'
import { prisma } from '@database/prisma.js'
import { logger } from '@config/logger.js'
import { dayjs } from '@shared/utils/date.util.js'
import { storage } from '@shared/storage/storage.js'
import * as repo from '@modules/query/query.repository.js'
import { reportQueue } from '@queue/queues.js'
import { REPORT_JOB_NAME } from '@queue/jobs/report.job.js'
import { buildMonthlyReportHtml } from './report.template.js'

// =============================================================================
// FinIA — Report Service
// =============================================================================
//
// Fluxo assíncrono (§3: nada pesado bloqueia request handlers):
//
//   API cria a linha (PENDING) + enfileira → worker chama generateReport():
//   GENERATING → coleta dados → HTML → storage → COMPLETED (ou FAILED).
//
// reportType suportado no Sprint 4: 'monthly_summary' (mês corrente ou um mês
// específico via periodStart).
//
// =============================================================================

export async function requestMonthlyReport(
  userId: string,
  /** Qualquer instante dentro do mês desejado; default = agora (mês corrente) */
  monthRef?: Date,
): Promise<Report> {
  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId },
    select: { timezone: true },
  })
  const ref = dayjs(monthRef ?? new Date()).tz(user.timezone)

  const report = await prisma.report.create({
    data: {
      userId,
      reportType: 'monthly_summary',
      periodStart: ref.startOf('month').utc().toDate(),
      periodEnd: ref.endOf('month').utc().toDate(),
      status: 'PENDING',
      format: 'html',
    },
  })

  await reportQueue.add(REPORT_JOB_NAME, { reportId: report.id })
  return report
}

/** Executado pelo worker. Nunca lança por erro de negócio — grava FAILED. */
export async function generateReport(reportId: string): Promise<void> {
  const report = await prisma.report.findUnique({ where: { id: reportId } })
  if (!report || report.status === 'COMPLETED') return

  await prisma.report.update({ where: { id: reportId }, data: { status: 'GENERATING' } })

  try {
    const user = await prisma.user.findFirstOrThrow({
      where: { id: report.userId },
      select: { name: true, timezone: true, currency: true },
    })

    const window = { start: report.periodStart, end: report.periodEnd }
    const [income, expenses, count, byCategory, merchants, transactions] = await Promise.all([
      repo.sumAmount(report.userId, 'INCOME', window),
      repo.sumAmount(report.userId, 'EXPENSE', window),
      repo.countTransactions(report.userId, window),
      repo.expenseBreakdown(report.userId, window, 12),
      repo.topMerchants(report.userId, window, 8),
      repo.transactionsInPeriod(report.userId, window, 500),
    ])

    const html = buildMonthlyReportHtml({
      userName: user.name,
      periodLabel: dayjs(report.periodStart).tz(user.timezone).format('MMMM [de] YYYY'),
      generatedAt: new Date(),
      timezone: user.timezone,
      currency: user.currency,
      totalIncome: income,
      totalExpenses: expenses,
      transactionCount: count,
      byCategory,
      topMerchants: merchants,
      transactions,
    })

    const saved = await storage.save(`${report.userId}/${report.id}.html`, html)

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'COMPLETED',
        filePath: saved.relativePath,
        fileSize: saved.size,
        completedAt: new Date(),
      },
    })
    logger.info({ reportId, size: saved.size }, 'Relatório gerado')
  } catch (error) {
    logger.error({ err: error, reportId }, 'Falha ao gerar relatório')
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'erro desconhecido',
      },
    })
  }
}
