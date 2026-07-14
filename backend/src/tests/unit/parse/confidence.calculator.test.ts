import { describe, it, expect } from 'vitest'
import { calculateConfidence } from '@modules/parse/deterministic/confidence.calculator.js'

// =============================================================================
// FinIA — Testes: Confidence Calculator
// =============================================================================

describe('calculateConfidence', () => {
  it('nada extraído → 0', () => {
    expect(
      calculateConfidence({ hasAmount: false, hasType: false, hasMerchant: false, hasContext: false }),
    ).toBe(0)
  })

  it('apenas valor → 0.45 (vai para IA)', () => {
    expect(
      calculateConfidence({ hasAmount: true, hasType: false, hasMerchant: false, hasContext: false }),
    ).toBe(0.45)
  })

  it('valor + descrição → 0.65 (salva com revisão)', () => {
    expect(
      calculateConfidence({ hasAmount: true, hasType: false, hasMerchant: false, hasContext: true }),
    ).toBe(0.65)
  })

  it('valor + descrição + merchant → 0.80 (salva com revisão)', () => {
    expect(
      calculateConfidence({ hasAmount: true, hasType: false, hasMerchant: true, hasContext: true }),
    ).toBe(0.8)
  })

  it('valor + descrição + tipo → 0.85 (salva direto)', () => {
    expect(
      calculateConfidence({ hasAmount: true, hasType: true, hasMerchant: false, hasContext: true }),
    ).toBe(0.85)
  })

  it('tudo presente → 1.00', () => {
    expect(
      calculateConfidence({ hasAmount: true, hasType: true, hasMerchant: true, hasContext: true }),
    ).toBe(1)
  })

  it('resultado sempre entre 0 e 1', () => {
    const score = calculateConfidence({ hasAmount: true, hasType: true, hasMerchant: true, hasContext: true })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})
