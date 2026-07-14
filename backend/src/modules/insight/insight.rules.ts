import type { InsightType } from '@prisma/client'
import { formatBRL, round2 } from '@shared/utils/currency.util.js'
import type { InsightInput } from './insight.data.js'

// =============================================================================
// FinIA — Regras determinísticas de insight
// =============================================================================
//
// Funções PURAS (InsightInput → insights) — testáveis sem banco/IA.
// Thresholds seguem o §7.3 ("variações > 20%, etc.") com pisos de relevância
// em reais para não gerar ruído sobre valores triviais.
//
// =============================================================================

export interface GeneratedInsight {
  type: InsightType
  title: string
  body: string
  data: Record<string, unknown>
}

// Pisos de relevância: variação só vira insight se envolver dinheiro de verdade
const MIN_CATEGORY_BASE = 50 // R$ mínimos no mês anterior para comparar
const MIN_ANOMALY_VALUE = 100 // gasto mínimo para ser "anomalia"
const VARIATION_THRESHOLD = 0.2 // ±20% (§7.3)
const RANKING_SHARE = 0.35 // categoria dominante: ≥35% dos gastos
const MAX_DETERMINISTIC = 5

export function generateDeterministicInsights(input: InsightInput): GeneratedInsight[] {
  const insights: GeneratedInsight[] = []
  const { currency } = input

  // ─── 1. Variações por categoria (>±20% vs mês anterior) ────────────────────
  const variations = input.byCategory
    .filter((c) => c.previous >= MIN_CATEGORY_BASE)
    .map((c) => ({ ...c, delta: c.previous > 0 ? (c.current - c.previous) / c.previous : 0 }))
    .filter((c) => Math.abs(c.delta) >= VARIATION_THRESHOLD)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  for (const v of variations.slice(0, 2)) {
    const pct = Math.round(Math.abs(v.delta) * 100)
    if (v.delta > 0) {
      insights.push({
        type: 'SPENDING_INCREASE',
        title: `Gastos com ${v.categoryName} subiram ${pct}%`,
        body:
          `Você gastou ${formatBRL(v.current, currency)} com ${v.categoryName} até agora, ` +
          `contra ${formatBRL(v.previous, currency)} no mês passado (+${pct}%).`,
        data: { category: v.categoryName, current: v.current, previous: v.previous, delta: round2(v.delta) },
      })
    } else {
      insights.push({
        type: 'SPENDING_DECREASE',
        title: `Gastos com ${v.categoryName} caíram ${pct}%`,
        body:
          `Boa! ${formatBRL(v.current, currency)} com ${v.categoryName} neste mês, ` +
          `contra ${formatBRL(v.previous, currency)} no anterior (-${pct}%).`,
        data: { category: v.categoryName, current: v.current, previous: v.previous, delta: round2(v.delta) },
      })
    }
  }

  // ─── 2. Categoria dominante (ranking) ──────────────────────────────────────
  if (input.currentExpenses > 0 && input.byCategory.length >= 2) {
    const top = [...input.byCategory].sort((a, b) => b.current - a.current)[0]
    const share = top.current / input.currentExpenses
    if (share >= RANKING_SHARE) {
      insights.push({
        type: 'CATEGORY_RANKING',
        title: `${top.categoryName} concentra ${Math.round(share * 100)}% dos gastos`,
        body:
          `${formatBRL(top.current, currency)} dos seus ${formatBRL(input.currentExpenses, currency)} ` +
          `em gastos do mês foram com ${top.categoryName}.`,
        data: { category: top.categoryName, total: top.current, share: round2(share) },
      })
    }
  }

  // ─── 3. Tendência de economia ──────────────────────────────────────────────
  if (input.currentIncome > 0) {
    const savings = input.currentIncome - input.currentExpenses
    const rate = savings / input.currentIncome
    if (rate >= 0.2) {
      insights.push({
        type: 'SAVINGS_TREND',
        title: `Você está economizando ${Math.round(rate * 100)}% da renda`,
        body:
          `Entradas de ${formatBRL(input.currentIncome, currency)} e saídas de ` +
          `${formatBRL(input.currentExpenses, currency)} — sobra de ${formatBRL(savings, currency)}.`,
        data: { income: input.currentIncome, expenses: input.currentExpenses, rate: round2(rate) },
      })
    }
  }

  // ─── 4. Anomalia: gasto muito acima do padrão ──────────────────────────────
  if (input.largestExpense && input.transactionCount >= 5) {
    const avg = input.currentExpenses / Math.max(input.transactionCount, 1)
    const { amount, merchantName, description } = input.largestExpense
    if (amount >= MIN_ANOMALY_VALUE && amount >= avg * 3) {
      const label = merchantName ?? description ?? 'um gasto'
      insights.push({
        type: 'ANOMALY',
        title: `Gasto atípico: ${formatBRL(amount, currency)}`,
        body:
          `${label} custou ${formatBRL(amount, currency)} — bem acima do seu padrão do mês. ` +
          `Se foi pontual, tudo certo; só vale conferir.`,
        data: { amount, merchantName, description },
      })
    }
  }

  return insights.slice(0, MAX_DETERMINISTIC)
}
