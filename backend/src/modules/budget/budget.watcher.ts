import { prisma } from '@database/prisma.js'
import { cacheService } from '@cache/cache.service.js'
import { logger } from '@config/logger.js'
import { eventBus, EVENTS, type TransactionEventPayload } from '@shared/events/event.bus.js'
import * as notificationService from '@modules/notification/notification.service.js'
import { budgetAlertTemplate } from '@modules/notification/templates/index.js'
import { computeBudgetStatus } from './budget.service.js'

// =============================================================================
// FinIA — Budget Watcher
// =============================================================================
//
// Escuta transaction.created e, para gastos em categorias com orçamento ativo,
// verifica se o limite cruzou o alertThreshold (ex: 0.80 = 80%). Se cruzou:
//
//   1. Envia alerta via WhatsApp (fila de notificação)
//   2. Registra um insight BUDGET_ALERT (histórico no dashboard)
//
// Anti-spam: no máximo UM alerta por budget por período (marker SET NX no
// Redis com a chave do período — mês/semana/ano).
//
// Best-effort: falha aqui é logada e nunca derruba o pipeline de transações.
//
// =============================================================================

// TTL do marker: 35 dias cobre o maior período recorrente (mês) com folga;
// período novo = chave nova, então o TTL só evita lixo acumulado.
const ALERT_MARKER_TTL = 60 * 60 * 24 * 35

const alertMarkerKey = (budgetId: string, periodKey: string): string =>
  `budgetalert:${budgetId}:${periodKey}`

async function onTransactionCreated(payload: TransactionEventPayload): Promise<void> {
  try {
    if (payload.type !== 'EXPENSE') return

    const budgets = await prisma.budget.findMany({
      where: {
        userId: payload.userId,
        categoryId: payload.categoryId,
        active: true,
        deletedAt: null,
      },
    })
    if (budgets.length === 0) return

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, deletedAt: null },
      select: { phoneNumber: true, timezone: true, currency: true },
    })
    if (!user) return

    for (const budget of budgets) {
      const status = await computeBudgetStatus(budget, user.timezone)
      if (status.ratio < Number(budget.alertThreshold)) continue

      // Um alerta por budget por período
      const isFirst = await cacheService.markIfFirst(
        alertMarkerKey(budget.id, status.window.key),
        ALERT_MARKER_TTL,
      )
      if (!isFirst) continue

      const category = await prisma.category.findFirst({
        where: { id: budget.categoryId },
        select: { name: true },
      })
      const categoryName = category?.name ?? 'Categoria'

      // Notificação por WhatsApp: só se o usuário tiver telefone (cadastro web não tem)
      if (user.phoneNumber) {
        await notificationService.sendText(
          user.phoneNumber,
          budgetAlertTemplate(categoryName, status.spent, status.limit, status.window.label, user.currency),
          payload.userId,
        )
      }

      await prisma.aIInsight.create({
        data: {
          userId: payload.userId,
          type: 'BUDGET_ALERT',
          title: `Orçamento de ${categoryName} em ${Math.round(status.ratio * 100)}%`,
          body:
            `Você já usou ${Math.round(status.ratio * 100)}% do orçamento de ` +
            `${categoryName} ${status.window.label}.`,
          data: { budgetId: budget.id, spent: status.spent, limit: status.limit, ratio: status.ratio },
          periodStart: status.window.start,
          periodEnd: status.window.end,
          aiGenerated: false,
          notifiedAt: new Date(),
        },
      })

      logger.info(
        { userId: payload.userId, budgetId: budget.id, ratio: status.ratio },
        'Alerta de orçamento enviado',
      )
    }
  } catch (err) {
    logger.error({ err }, 'budget.watcher: falha ao processar alerta (best-effort)')
  }
}

let registered = false

/** Registra o watcher no event bus (chamado uma vez no boot do servidor). */
export function initBudgetWatcher(): void {
  if (registered) return
  registered = true
  eventBus.on(EVENTS.TRANSACTION_CREATED, (payload: TransactionEventPayload) => {
    void onTransactionCreated(payload)
  })
  logger.info('Budget watcher ativo (alertas de orçamento via WhatsApp)')
}
