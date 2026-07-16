import type { Prisma } from '@prisma/client'
import { prisma } from '@database/prisma.js'
import { logger } from '@config/logger.js'
import * as notificationService from '@modules/notification/notification.service.js'
import { insightsSummaryTemplate } from '@modules/notification/templates/index.js'
import { collectInsightInput } from './insight.data.js'
import { generateDeterministicInsights, type GeneratedInsight } from './insight.rules.js'
import { generateNarrativeInsights } from './insight.narrative.js'
import { AI_MODELS } from '@config/constants.js'

// =============================================================================
// FinIA — Insight Engine (§7.3)
// =============================================================================
//
//   Coleta agregados → regras determinísticas → (cron: narrativa via Sonnet)
//   → persiste em ai_insights (com dedupe por período) → resumo via WhatsApp
//
// Narrativa SÓ no gatilho cron (1x/semana — controle de custo §4). A geração
// sob demanda pelo dashboard usa apenas as regras determinísticas (grátis).
//
// =============================================================================

export type InsightTrigger = 'cron' | 'demand'

export interface EngineResult {
  created: number
  skippedDuplicates: number
}

export async function runInsightEngine(
  userId: string,
  trigger: InsightTrigger,
): Promise<EngineResult> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { phoneNumber: true, timezone: true, currency: true },
  })
  if (!user) return { created: 0, skippedDuplicates: 0 }

  const input = await collectInsightInput(userId, user.timezone, user.currency)

  const deterministic = generateDeterministicInsights(input)
  const narrative = trigger === 'cron' ? await generateNarrativeInsights(input) : []
  const candidates: GeneratedInsight[] = [...deterministic, ...narrative]

  if (candidates.length === 0) return { created: 0, skippedDuplicates: 0 }

  // Dedupe: não recriar um insight de mesmo tipo+título dentro do mesmo período
  const existing = await prisma.aIInsight.findMany({
    where: { userId, periodStart: input.periodStart, dismissedAt: null },
    select: { type: true, title: true },
  })
  const seen = new Set(existing.map((e) => `${e.type}|${e.title}`))

  const fresh = candidates.filter((c) => !seen.has(`${c.type}|${c.title}`))
  const skippedDuplicates = candidates.length - fresh.length

  if (fresh.length > 0) {
    await prisma.aIInsight.createMany({
      data: fresh.map((c) => ({
        userId,
        type: c.type,
        title: c.title,
        body: c.body,
        data: c.data as Prisma.InputJsonValue,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        aiGenerated: c.type === 'GENERIC',
        aiModel: c.type === 'GENERIC' ? AI_MODELS.INSIGHTS : null,
        ...(trigger === 'cron' ? { notifiedAt: new Date() } : {}),
      })),
    })
  }

  // Resumo via WhatsApp apenas no cron (sob demanda o usuário já está no painel)
  // e apenas se o usuário tiver telefone (cadastro web não tem).
  if (trigger === 'cron' && fresh.length > 0 && user.phoneNumber) {
    await notificationService.sendText(
      user.phoneNumber,
      insightsSummaryTemplate(fresh.slice(0, 3).map((c) => c.title)),
      userId,
    )
  }

  logger.info(
    { userId, trigger, created: fresh.length, skippedDuplicates },
    'InsightEngine executado',
  )
  return { created: fresh.length, skippedDuplicates }
}
