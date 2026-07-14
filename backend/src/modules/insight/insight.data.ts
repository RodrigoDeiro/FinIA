import { dayjs } from '@shared/utils/date.util.js'
import * as repo from '@modules/query/query.repository.js'

// =============================================================================
// FinIA — Coleta de dados do InsightEngine
// =============================================================================
//
// Monta o InsightInput (§7.3): mês atual vs anterior, breakdown por categoria
// (comparado), top merchants, maior gasto e histórico de 3 meses (narrativa).
// Toda a coleta é agregada — nenhum dado cru vai para a IA.
//
// =============================================================================

export interface CategoryComparison {
  categoryName: string
  current: number
  previous: number
}

export interface MonthTotals {
  label: string
  expenses: number
  income: number
}

export interface InsightInput {
  currency: string
  monthLabel: string
  periodStart: Date
  periodEnd: Date
  currentExpenses: number
  previousExpenses: number
  currentIncome: number
  previousIncome: number
  transactionCount: number
  byCategory: CategoryComparison[]
  topMerchants: Array<{ merchantName: string; total: number }>
  largestExpense: { amount: number; merchantName: string | null; description: string | null } | null
  /** Últimos 3 meses fechados + mês corrente (para a narrativa da IA) */
  history: MonthTotals[]
}

export async function collectInsightInput(
  userId: string,
  timezone: string,
  currency: string,
): Promise<InsightInput> {
  const now = dayjs().tz(timezone)
  const current = { start: now.startOf('month').utc().toDate(), end: now.utc().toDate() }
  const prevStart = now.subtract(1, 'month').startOf('month')
  const previous = { start: prevStart.utc().toDate(), end: prevStart.endOf('month').utc().toDate() }

  const [
    currentExpenses,
    previousExpenses,
    currentIncome,
    previousIncome,
    transactionCount,
    currentBreakdown,
    previousBreakdown,
    merchants,
    largest,
  ] = await Promise.all([
    repo.sumAmount(userId, 'EXPENSE', current),
    repo.sumAmount(userId, 'EXPENSE', previous),
    repo.sumAmount(userId, 'INCOME', current),
    repo.sumAmount(userId, 'INCOME', previous),
    repo.countTransactions(userId, current),
    repo.expenseBreakdown(userId, current, 12),
    repo.expenseBreakdown(userId, previous, 12),
    repo.topMerchants(userId, current, 5),
    repo.largestExpense(userId, current),
  ])

  // Junta os breakdowns por nome de categoria (atual vs anterior)
  const prevByName = new Map(previousBreakdown.map((c) => [c.categoryName, c.total]))
  const names = new Set([
    ...currentBreakdown.map((c) => c.categoryName),
    ...previousBreakdown.map((c) => c.categoryName),
  ])
  const currByName = new Map(currentBreakdown.map((c) => [c.categoryName, c.total]))
  const byCategory: CategoryComparison[] = [...names].map((name) => ({
    categoryName: name,
    current: currByName.get(name) ?? 0,
    previous: prevByName.get(name) ?? 0,
  }))

  // Histórico: 3 meses fechados anteriores + mês corrente
  const history: MonthTotals[] = []
  for (let i = 3; i >= 0; i--) {
    const m = now.subtract(i, 'month')
    const window =
      i === 0
        ? current
        : {
            start: m.startOf('month').utc().toDate(),
            end: m.endOf('month').utc().toDate(),
          }
    const [expenses, income] = await Promise.all([
      repo.sumAmount(userId, 'EXPENSE', window),
      repo.sumAmount(userId, 'INCOME', window),
    ])
    history.push({ label: m.format('MMMM/YYYY'), expenses, income })
  }

  return {
    currency,
    monthLabel: now.format('MMMM [de] YYYY'),
    periodStart: current.start,
    periodEnd: current.end,
    currentExpenses,
    previousExpenses,
    currentIncome,
    previousIncome,
    transactionCount,
    byCategory,
    topMerchants: merchants,
    largestExpense: largest,
    history,
  }
}
