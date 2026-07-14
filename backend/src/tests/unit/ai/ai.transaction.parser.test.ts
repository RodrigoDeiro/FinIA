import { describe, it, expect, vi, beforeEach } from 'vitest'

// =============================================================================
// FinIA — Testes: AI Transaction Parser (Claude mockado)
// =============================================================================
//
// Mockamos o client da Anthropic para validar a LÓGICA do parser (validação
// defensiva da saída, fallback de tipo, tratamento de erro) sem gastar API.
//
// =============================================================================

const createMock = vi.fn()

vi.mock('@modules/ai/anthropic.client.js', () => ({
  getAnthropicClient: () => ({ messages: { create: createMock } }),
  isAiConfigured: () => true,
}))

// Import APÓS o mock (vi.mock é içado, mas deixamos explícito a ordem lógica)
const { extractTransactionWithAI } = await import(
  '@modules/ai/ai.transaction.parser.js'
)

function toolUseResponse(input: Record<string, unknown>) {
  return { content: [{ type: 'tool_use', name: 'record_transaction', input }] }
}

beforeEach(() => createMock.mockReset())

describe('extractTransactionWithAI', () => {
  it('extrai uma transação válida', async () => {
    createMock.mockResolvedValue(
      toolUseResponse({
        type: 'EXPENSE',
        amount: 35,
        merchantName: 'Extra',
        categorySlug: 'alimentacao',
        confidence: 0.95,
      }),
    )
    const r = await extractTransactionWithAI('msg', ['alimentacao'])
    expect(r).toMatchObject({
      type: 'EXPENSE',
      amount: 35,
      merchantName: 'Extra',
      categorySlug: 'alimentacao',
      confidence: 0.95,
    })
  })

  it('retorna null quando não há valor positivo', async () => {
    createMock.mockResolvedValue(toolUseResponse({ type: 'EXPENSE', amount: 0, confidence: 0.9 }))
    expect(await extractTransactionWithAI('msg', [])).toBeNull()
  })

  it('cai para EXPENSE quando o type é inválido', async () => {
    createMock.mockResolvedValue(toolUseResponse({ type: 'BOGUS', amount: 10, confidence: 0.8 }))
    expect((await extractTransactionWithAI('msg', []))?.type).toBe('EXPENSE')
  })

  it('normaliza merchantName/categorySlug ausentes para null', async () => {
    createMock.mockResolvedValue(toolUseResponse({ type: 'INCOME', amount: 5000, confidence: 0.9 }))
    const r = await extractTransactionWithAI('msg', [])
    expect(r?.merchantName).toBeNull()
    expect(r?.categorySlug).toBeNull()
  })

  it('retorna null quando a resposta não tem tool_use', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'oi' }] })
    expect(await extractTransactionWithAI('msg', [])).toBeNull()
  })
})
