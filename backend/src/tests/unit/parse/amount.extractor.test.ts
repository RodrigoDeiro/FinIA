import { describe, it, expect } from 'vitest'
import { extractAmount } from '@modules/parse/deterministic/amount.extractor.js'

// =============================================================================
// FinIA — Testes: Amount Extractor
// =============================================================================

describe('extractAmount — valores reconhecidos', () => {
  const cases: Array<[string, number]> = [
    // Número solto (mais comum)
    ['Mercado 89,90', 89.9],
    ['uber 25', 25],
    ['recebi 5000', 5000],
    ['ifood 45,90', 45.9],
    ['99,99', 99.99],
    ['10', 10],

    // Com R$
    ['R$ 89,90', 89.9],
    ['R$89,90', 89.9],
    ['R$ 1.000,00', 1000],
    ['R$1,00', 1],
    ['paguei R$ 12,50', 12.5],

    // Unidades coloquiais
    ['50 reais', 50],
    ['30 conto', 30],
    ['100 pila', 100],
    ['20 paus', 20],

    // Milhar
    ['2 mil', 2000],
    ['1,5 mil', 1500],
    ['10 mil', 10000],

    // Separadores brasileiros
    ['1.500', 1500],
    ['1.234,56', 1234.56],
    ['1.000.000', 1000000],
    ['comprei por 3.50', 3.5],

    // Em frases
    ['gastei 12,50 no lanche', 12.5],
    ['paguei 100 de luz', 100],
    ['recebi salário 5000 hoje', 5000],
    ['investi 500 no tesouro', 500],
  ]

  it.each(cases)('extrai de "%s" → %d', (text, expected) => {
    const result = extractAmount(text)
    expect(result).not.toBeNull()
    expect(result?.value).toBe(expected)
  })
})

describe('extractAmount — sem valor', () => {
  const noValue = ['', 'oi', 'ajuda', 'bom dia', 'meia dúzia', '0', 'R$ 0,00', 'obrigado']

  it.each(noValue)('não extrai de "%s"', (text) => {
    expect(extractAmount(text)).toBeNull()
  })
})

describe('extractAmount — metadados', () => {
  it('retorna o trecho original (raw)', () => {
    const result = extractAmount('R$ 89,90')
    expect(result?.raw.toLowerCase()).toContain('89,90')
  })

  it('prioriza "mil" sobre número solto', () => {
    expect(extractAmount('2 mil')?.value).toBe(2000)
  })

  it('arredonda a 2 casas', () => {
    const result = extractAmount('R$ 10,999')
    expect(result?.value).toBe(11)
  })
})
