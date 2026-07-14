import { describe, it, expect } from 'vitest'
import { TransactionType } from '@prisma/client'
import { extractIntent } from '@modules/parse/deterministic/intent.extractor.js'

// =============================================================================
// FinIA — Testes: Intent Extractor
// =============================================================================

describe('extractIntent — tipos explícitos', () => {
  const cases: Array<[string, TransactionType]> = [
    ['gastei 50', TransactionType.EXPENSE],
    ['paguei a conta de luz', TransactionType.EXPENSE],
    ['comprei pão', TransactionType.EXPENSE],
    ['recebi salário 5000', TransactionType.INCOME],
    ['ganhei 100 de bônus', TransactionType.INCOME],
    ['caiu o pagamento', TransactionType.INCOME],
    ['investi 500', TransactionType.INVESTMENT],
    ['comprei bitcoin', TransactionType.INVESTMENT],
    ['fiz um aporte no tesouro', TransactionType.INVESTMENT],
    ['transferi 200 pro joão', TransactionType.TRANSFER],
    ['minha dívida do cartão', TransactionType.DEBT],
    ['paguei a parcela do carro', TransactionType.DEBT],
  ]

  it.each(cases)('"%s" → %s', (text, expected) => {
    const result = extractIntent(text)
    expect(result.type).toBe(expected)
    expect(result.explicit).toBe(true)
  })
})

describe('extractIntent — default (sem palavra-chave)', () => {
  const defaults = ['Mercado 89,90', 'uber 25', 'ifood 45', 'farmácia 30']

  it.each(defaults)('"%s" → EXPENSE não-explícito', (text) => {
    const result = extractIntent(text)
    expect(result.type).toBe(TransactionType.EXPENSE)
    expect(result.explicit).toBe(false)
    expect(result.matchedKeyword).toBeNull()
  })
})

describe('extractIntent — precedência', () => {
  it('INVESTMENT vence EXPENSE em "comprei bitcoin"', () => {
    // "comprei" é palavra de EXPENSE, mas "bitcoin" (INVESTMENT) é checado antes
    expect(extractIntent('comprei bitcoin').type).toBe(TransactionType.INVESTMENT)
  })

  it('ignora acentos', () => {
    expect(extractIntent('recebí salário').type).toBe(TransactionType.INCOME)
  })
})
