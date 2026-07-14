import type { Budget } from '@prisma/client'
import { round2 } from '@shared/utils/currency.util.js'
import { sumAmount } from '@modules/query/query.repository.js'
import { currentPeriodWindow, type PeriodWindow } from './budget.period.js'

// =============================================================================
// FinIA — Budget Service
// =============================================================================
//
// Cálculo do status de um orçamento no período corrente: quanto já foi gasto
// na categoria, percentual do limite e quanto resta. Usado pela API (listagem
// com status) e pelo watcher de alertas.
//
// =============================================================================

export interface BudgetStatus {
  spent: number
  limit: number
  /** 0–N (1.0 = 100% do limite; pode passar de 1) */
  ratio: number
  remaining: number
  window: PeriodWindow
}

export async function computeBudgetStatus(budget: Budget, timezone: string): Promise<BudgetStatus> {
  const window = currentPeriodWindow(budget.period, timezone)
  const spent = await sumAmount(
    budget.userId,
    'EXPENSE',
    { start: window.start, end: window.end },
    budget.categoryId,
  )
  const limit = Number(budget.amount)
  return {
    spent,
    limit,
    ratio: limit > 0 ? round2(spent / limit) : 0,
    remaining: round2(limit - spent),
    window,
  }
}
