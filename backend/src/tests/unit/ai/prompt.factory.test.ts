import { describe, it, expect } from 'vitest'
import { buildTransactionSystemPrompt } from '@modules/ai/prompt.factory.js'

// =============================================================================
// FinIA — Testes: AI Prompt Factory
// =============================================================================

describe('buildTransactionSystemPrompt', () => {
  it('inclui os slugs de categoria válidos', () => {
    const prompt = buildTransactionSystemPrompt(['alimentacao', 'transporte'])
    expect(prompt).toContain('alimentacao')
    expect(prompt).toContain('transporte')
  })

  it('instrui a chamar a ferramenta record_transaction', () => {
    expect(buildTransactionSystemPrompt([])).toContain('record_transaction')
  })

  it('orienta confiança baixa para não-transações', () => {
    expect(buildTransactionSystemPrompt([])).toMatch(/confidence < 0\.3/)
  })
})
