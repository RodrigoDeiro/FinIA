import { describe, it, expect } from 'vitest'
import { parseBRLToNumber, round2, formatBRL } from '@shared/utils/currency.util.js'

// =============================================================================
// FinIA — Testes: Currency Util
// =============================================================================

describe('parseBRLToNumber', () => {
  const cases: Array<[string, number | null]> = [
    ['89,90', 89.9],
    ['1.234,56', 1234.56],
    ['1.500', 1500],
    ['1.000.000', 1000000],
    ['89.90', 89.9],
    ['1,5', 1.5],
    ['100', 100],
    ['R$ 50,00', 50],
    ['1.234.567,89', 1234567.89],
    ['', null],
    ['abc', null],
  ]

  it.each(cases)('"%s" -> %s', (input, expected) => {
    expect(parseBRLToNumber(input)).toBe(expected)
  })
})

describe('round2', () => {
  it('arredonda a 2 casas', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(10.999)).toBe(11)
    expect(round2(45.904)).toBe(45.9)
  })
})

describe('formatBRL', () => {
  it('formata como moeda brasileira', () => {
    // O Intl insere um espaço não-quebrável (U+00A0) entre "R$" e o número;
    // normalizamos qualquer espaço para um espaço comum antes de comparar.
    const formatted = formatBRL(1234.5).replace(/\s/g, ' ')
    expect(formatted).toBe('R$ 1.234,50')
  })
})
