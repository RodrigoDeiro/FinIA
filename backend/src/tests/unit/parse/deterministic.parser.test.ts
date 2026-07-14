import { describe, it, expect } from 'vitest'
import { TransactionType } from '@prisma/client'
import { parseDeterministic, type ParseContext } from '@modules/parse/deterministic/deterministic.parser.js'
import type { MerchantRecord } from '@modules/parse/deterministic/merchant-db/merchant.db.js'

// =============================================================================
// FinIA — Testes: Deterministic Parser (orquestração pura)
// =============================================================================

const MERCHANTS: MerchantRecord[] = [
  { id: 'g1', name: 'iFood', slug: 'ifood', aliases: ['i food'], categoryId: 'cat-alim', defaultType: TransactionType.EXPENSE },
]

const ctx = (over: Partial<ParseContext> = {}): ParseContext => ({
  timezone: 'America/Sao_Paulo',
  userMerchants: [],
  globalMerchants: MERCHANTS,
  ...over,
})

describe('parseDeterministic', () => {
  it('"iFood 45,90" → gasto reconhecido, confiança 0.80', () => {
    const r = parseDeterministic('iFood 45,90', ctx())
    expect(r.amount).toBe(45.9)
    expect(r.type).toBe(TransactionType.EXPENSE)
    expect(r.merchantName).toBe('iFood')
    expect(r.categoryId).toBe('cat-alim')
    expect(r.confidence).toBe(0.8)
  })

  it('"Mercado 89,90" (merchant desconhecido) → 0.65, sem categoria', () => {
    const r = parseDeterministic('Mercado 89,90', ctx())
    expect(r.amount).toBe(89.9)
    expect(r.merchantId).toBeNull()
    expect(r.categoryId).toBeNull()
    expect(r.confidence).toBe(0.65)
  })

  it('"recebi salário 5000" → INCOME, confiança 0.85 (salva direto)', () => {
    const r = parseDeterministic('recebi salário 5000', ctx())
    expect(r.type).toBe(TransactionType.INCOME)
    expect(r.amount).toBe(5000)
    expect(r.confidence).toBe(0.85)
  })

  it('"oi" (sem valor) → amount null e confiança baixa', () => {
    const r = parseDeterministic('oi', ctx())
    expect(r.amount).toBeNull()
    expect(r.confidence).toBeLessThan(0.65)
  })

  it('merchant define o tipo quando não há verbo explícito', () => {
    const invest: MerchantRecord[] = [
      { id: 'x', name: 'XP', slug: 'xp', aliases: [], categoryId: 'cat-inv', defaultType: TransactionType.INVESTMENT },
    ]
    const r = parseDeterministic('xp 1000', ctx({ globalMerchants: invest }))
    expect(r.type).toBe(TransactionType.INVESTMENT)
  })

  it('preserva o texto original como descrição', () => {
    expect(parseDeterministic('  uber 25  ', ctx()).description).toBe('uber 25')
  })
})
