import { describe, it, expect } from 'vitest'
import { generateDeterministicInsights } from '@modules/insight/insight.rules.js'
import type { InsightInput } from '@modules/insight/insight.data.js'

// =============================================================================
// FinIA — Testes: regras determinísticas de insight
// =============================================================================

function baseInput(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    currency: 'BRL',
    monthLabel: 'julho de 2026',
    periodStart: new Date('2026-07-01T00:00:00Z'),
    periodEnd: new Date('2026-07-15T00:00:00Z'),
    currentExpenses: 0,
    previousExpenses: 0,
    currentIncome: 0,
    previousIncome: 0,
    transactionCount: 0,
    byCategory: [],
    topMerchants: [],
    largestExpense: null,
    history: [],
    ...overrides,
  }
}

describe('SPENDING_INCREASE / DECREASE', () => {
  it('gasto subiu >20% com base relevante → SPENDING_INCREASE', () => {
    const insights = generateDeterministicInsights(
      baseInput({
        currentExpenses: 600,
        byCategory: [{ categoryName: 'Alimentação', current: 600, previous: 400 }],
      }),
    )
    const inc = insights.find((i) => i.type === 'SPENDING_INCREASE')
    expect(inc).toBeDefined()
    expect(inc?.title).toContain('Alimentação')
    expect(inc?.title).toContain('50%')
  })

  it('gasto caiu >20% → SPENDING_DECREASE', () => {
    const insights = generateDeterministicInsights(
      baseInput({
        currentExpenses: 100,
        byCategory: [{ categoryName: 'Lazer', current: 100, previous: 200 }],
      }),
    )
    expect(insights.some((i) => i.type === 'SPENDING_DECREASE')).toBe(true)
  })

  it('variação sobre base irrisória (< R$50) é ignorada', () => {
    const insights = generateDeterministicInsights(
      baseInput({
        currentExpenses: 30,
        byCategory: [{ categoryName: 'Lazer', current: 30, previous: 10 }],
      }),
    )
    expect(insights.some((i) => i.type === 'SPENDING_INCREASE')).toBe(false)
  })

  it('variação < 20% não gera insight', () => {
    const insights = generateDeterministicInsights(
      baseInput({
        currentExpenses: 110,
        byCategory: [{ categoryName: 'Mercado', current: 110, previous: 100 }],
      }),
    )
    expect(insights).toHaveLength(0)
  })
})

describe('CATEGORY_RANKING', () => {
  it('categoria com ≥35% dos gastos → ranking', () => {
    const insights = generateDeterministicInsights(
      baseInput({
        currentExpenses: 1000,
        byCategory: [
          { categoryName: 'Moradia', current: 500, previous: 480 },
          { categoryName: 'Alimentação', current: 300, previous: 310 },
          { categoryName: 'Lazer', current: 200, previous: 190 },
        ],
      }),
    )
    const rank = insights.find((i) => i.type === 'CATEGORY_RANKING')
    expect(rank?.title).toContain('Moradia')
    expect(rank?.title).toContain('50%')
  })
})

describe('SAVINGS_TREND', () => {
  it('economia ≥20% da renda → insight', () => {
    const insights = generateDeterministicInsights(
      baseInput({ currentIncome: 5000, currentExpenses: 3000 }),
    )
    const trend = insights.find((i) => i.type === 'SAVINGS_TREND')
    expect(trend?.title).toContain('40%')
  })

  it('sem renda → sem insight de economia', () => {
    const insights = generateDeterministicInsights(
      baseInput({ currentIncome: 0, currentExpenses: 500 }),
    )
    expect(insights.some((i) => i.type === 'SAVINGS_TREND')).toBe(false)
  })
})

describe('ANOMALY', () => {
  it('gasto ≥3x a média do mês → anomalia', () => {
    const insights = generateDeterministicInsights(
      baseInput({
        currentExpenses: 1000,
        transactionCount: 10, // média 100
        largestExpense: { amount: 400, merchantName: 'Magazine Luiza', description: null },
      }),
    )
    const anomaly = insights.find((i) => i.type === 'ANOMALY')
    expect(anomaly).toBeDefined()
    expect(anomaly?.body).toContain('Magazine Luiza')
  })

  it('poucas transações (<5) → sem anomalia (base estatística fraca)', () => {
    const insights = generateDeterministicInsights(
      baseInput({
        currentExpenses: 500,
        transactionCount: 2,
        largestExpense: { amount: 450, merchantName: 'X', description: null },
      }),
    )
    expect(insights.some((i) => i.type === 'ANOMALY')).toBe(false)
  })
})

describe('limites', () => {
  it('nunca gera mais que 5 insights determinísticos', () => {
    const insights = generateDeterministicInsights(
      baseInput({
        currentIncome: 10000,
        currentExpenses: 5000,
        transactionCount: 20,
        largestExpense: { amount: 2000, merchantName: 'Big', description: null },
        byCategory: [
          { categoryName: 'A', current: 2000, previous: 1000 },
          { categoryName: 'B', current: 100, previous: 500 },
          { categoryName: 'C', current: 2900, previous: 2000 },
        ],
      }),
    )
    expect(insights.length).toBeLessThanOrEqual(5)
  })
})
