import type { User } from '@prisma/client'
import { getSystemCategories } from '@modules/ai/category.resolver.js'
import * as repo from './query.repository.js'
import {
  expenseSumTemplate,
  incomeSumTemplate,
  balanceTemplate,
  topCategoriesTemplate,
  summaryTemplate,
} from './query.templates.js'
import type { DeterministicQuery } from './types/query.types.js'

// =============================================================================
// FinIA — Query Service
// =============================================================================
//
// Executa uma consulta estruturada (métrica + período + categoria) contra o
// banco e devolve a resposta já formatada. 100% determinístico — sem IA.
//
// =============================================================================

export async function executeQuery(query: DeterministicQuery, user: User): Promise<string> {
  const { metric, period, categorySlug } = query
  const currency = user.currency

  switch (metric) {
    case 'EXPENSE_SUM': {
      const { slugToId, slugToName } = await getSystemCategories()
      const categoryId = categorySlug ? slugToId.get(categorySlug) : undefined
      const total = await repo.sumAmount(user.id, 'EXPENSE', period, categoryId)
      const categoryName = categorySlug ? (slugToName.get(categorySlug) ?? null) : null
      return expenseSumTemplate(total, period.label, categoryName, currency)
    }

    case 'INCOME_SUM': {
      const total = await repo.sumAmount(user.id, 'INCOME', period)
      return incomeSumTemplate(total, period.label, currency)
    }

    case 'BALANCE': {
      const [income, expenses] = await Promise.all([
        repo.sumAmount(user.id, 'INCOME', period),
        repo.sumAmount(user.id, 'EXPENSE', period),
      ])
      return balanceTemplate(income, expenses, period.label, currency)
    }

    case 'TOP_CATEGORIES': {
      const breakdown = await repo.expenseBreakdown(user.id, period, 5)
      return topCategoriesTemplate(breakdown, period.label, currency)
    }

    case 'SUMMARY': {
      const [income, expenses, count, breakdown] = await Promise.all([
        repo.sumAmount(user.id, 'INCOME', period),
        repo.sumAmount(user.id, 'EXPENSE', period),
        repo.countTransactions(user.id, period),
        repo.expenseBreakdown(user.id, period, 3),
      ])
      return summaryTemplate(income, expenses, count, breakdown, period.label, currency)
    }
  }
}
