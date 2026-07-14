import { describe, it, expect } from 'vitest'
import {
  isFinancialQuery,
  detectQueryMetric,
} from '@modules/query/deterministic/query.detector.js'

// =============================================================================
// FinIA — Testes: Query Detector
// =============================================================================

describe('isFinancialQuery — reconhece consultas', () => {
  const queries = [
    'quanto gastei esse mês',
    'quanto gastei esse mês?',
    'Quanto recebi em junho?',
    'qual meu saldo',
    'saldo',
    'resumo',
    'extrato',
    'relatório',
    'onde gastei mais?',
    'estou gastando muito?',
    'quanto sobrou?',
  ]

  it.each(queries)('"%s" → consulta', (text) => {
    expect(isFinancialQuery(text)).toBe(true)
  })
})

describe('isFinancialQuery — NÃO sequestra transações nem conversa', () => {
  const nonQueries = [
    'gastei 50 no mercado', // transação (sem interrogativa)
    'Mercado 89,90', // transação
    'recebi salário 5000', // transação
    'uber 25 ontem', // transação
    'oi', // saudação
    'tudo bem?', // pergunta não-financeira
    'obrigado', // conversa
  ]

  it.each(nonQueries)('"%s" → não é consulta', (text) => {
    expect(isFinancialQuery(text)).toBe(false)
  })
})

describe('detectQueryMetric', () => {
  const cases: Array<[string, string | null]> = [
    ['quanto gastei esse mês', 'EXPENSE_SUM'],
    ['quanto saiu essa semana', 'EXPENSE_SUM'],
    ['quanto recebi esse mês', 'INCOME_SUM'],
    ['quanto ganhei hoje', 'INCOME_SUM'],
    ['qual meu saldo', 'BALANCE'],
    ['quanto sobrou', 'BALANCE'],
    ['resumo', 'SUMMARY'],
    ['extrato do mês', 'SUMMARY'],
    ['relatório', 'SUMMARY'],
    ['onde gastei mais', 'TOP_CATEGORIES'],
    ['maiores gastos do mês', 'TOP_CATEGORIES'],
    ['com o que gastei mais', 'TOP_CATEGORIES'],
    // Consultas complexas → null → IA responde
    ['estou gastando muito?', null],
    ['como posso economizar?', null],
  ]

  it.each(cases)('"%s" → %s', (text, expected) => {
    expect(detectQueryMetric(text)).toBe(expected)
  })
})
