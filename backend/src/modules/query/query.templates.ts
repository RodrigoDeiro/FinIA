import { formatBRL } from '@shared/utils/currency.util.js'
import type { CategoryTotal } from './query.repository.js'

// =============================================================================
// FinIA — Templates de resposta de consulta
// =============================================================================
//
// Funções puras: dados agregados → texto formatado para WhatsApp.
// Mesmo tom de voz dos templates de notificação.
//
// =============================================================================

export function expenseSumTemplate(
  total: number,
  periodLabel: string,
  categoryName: string | null,
  currency: string,
): string {
  const where = categoryName ? ` em *${categoryName}*` : ''
  if (total <= 0) {
    return `💸 Nenhum gasto${where} registrado ${periodLabel}. 👏`
  }
  return `💸 Você gastou *${formatBRL(total, currency)}*${where} ${periodLabel}.`
}

export function incomeSumTemplate(total: number, periodLabel: string, currency: string): string {
  if (total <= 0) {
    return `💰 Nenhuma receita registrada ${periodLabel}.`
  }
  return `💰 Você recebeu *${formatBRL(total, currency)}* ${periodLabel}.`
}

export function balanceTemplate(
  income: number,
  expenses: number,
  periodLabel: string,
  currency: string,
): string {
  const balance = income - expenses
  const emoji = balance >= 0 ? '🟢' : '🔴'
  return (
    `📊 *Balanço ${periodLabel}*\n` +
    `💰 Entradas: ${formatBRL(income, currency)}\n` +
    `💸 Saídas: ${formatBRL(expenses, currency)}\n` +
    `${emoji} Saldo: *${formatBRL(balance, currency)}*`
  )
}

export function topCategoriesTemplate(
  breakdown: CategoryTotal[],
  periodLabel: string,
  currency: string,
): string {
  if (breakdown.length === 0) {
    return `💸 Nenhum gasto registrado ${periodLabel}.`
  }
  const medals = ['🥇', '🥈', '🥉', '4º', '5º']
  const lines = breakdown.map(
    (c, i) => `${medals[i] ?? `${i + 1}º`} ${c.categoryName}: ${formatBRL(c.total, currency)}`,
  )
  return `🏆 *Maiores gastos ${periodLabel}*\n${lines.join('\n')}`
}

export function summaryTemplate(
  income: number,
  expenses: number,
  count: number,
  breakdown: CategoryTotal[],
  periodLabel: string,
  currency: string,
): string {
  if (count === 0) {
    return `📋 Nenhuma movimentação registrada ${periodLabel}.`
  }

  let msg = balanceTemplate(income, expenses, periodLabel, currency)
  msg += `\n🧾 ${count} ${count === 1 ? 'movimentação' : 'movimentações'}`

  if (breakdown.length > 0) {
    const top = breakdown
      .slice(0, 3)
      .map((c) => `• ${c.categoryName}: ${formatBRL(c.total, currency)}`)
      .join('\n')
    msg += `\n\n*Principais gastos:*\n${top}`
  }
  return msg
}

/** Quando nem o determinístico nem a IA conseguem responder a consulta. */
export function queryFallbackTemplate(): string {
  return (
    `🤔 Não consegui responder essa. Posso te dizer, por exemplo:\n` +
    `• _quanto gastei esse mês_\n` +
    `• _quanto recebi esse mês_\n` +
    `• _qual meu saldo_\n` +
    `• _resumo_ ou _onde gastei mais_`
  )
}
