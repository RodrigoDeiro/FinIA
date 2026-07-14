import { describe, it, expect } from 'vitest'
import { TransactionType } from '@prisma/client'
import { extractMerchant } from '@modules/parse/deterministic/merchant.extractor.js'
import type { MerchantRecord } from '@modules/parse/deterministic/merchant-db/merchant.db.js'

// =============================================================================
// FinIA — Testes: Merchant Extractor
// =============================================================================

const GLOBAL: MerchantRecord[] = [
  { id: 'g1', name: 'iFood', slug: 'ifood', aliases: ['i food'], categoryId: 'cat-alim', defaultType: TransactionType.EXPENSE },
  { id: 'g2', name: 'Uber', slug: 'uber', aliases: ['uber eats'], categoryId: 'cat-transp', defaultType: TransactionType.EXPENSE },
  { id: 'g3', name: 'Mercado Livre', slug: 'mercadolivre', aliases: ['mercado livre', 'ml'], categoryId: 'cat-compras', defaultType: TransactionType.EXPENSE },
  { id: 'g4', name: 'XP', slug: 'xp', aliases: ['xp investimentos'], categoryId: 'cat-invest', defaultType: TransactionType.INVESTMENT },
]

describe('extractMerchant — globais', () => {
  it('reconhece iFood', () => {
    const m = extractMerchant('iFood 45,90', [], GLOBAL)
    expect(m?.merchantId).toBe('g1')
    expect(m?.categoryId).toBe('cat-alim')
    expect(m?.fromUser).toBe(false)
  })

  it('reconhece via alias ("uber eats")', () => {
    expect(extractMerchant('paguei uber eats 30', [], GLOBAL)?.merchantId).toBe('g2')
  })

  it('herda defaultType INVESTMENT do merchant', () => {
    expect(extractMerchant('xp 1000', [], GLOBAL)?.defaultType).toBe(TransactionType.INVESTMENT)
  })

  it('não casa quando não há merchant conhecido', () => {
    expect(extractMerchant('padaria do josé 10', [], GLOBAL)).toBeNull()
  })

  it('ignora acentos e caixa', () => {
    expect(extractMerchant('IFOOD 20', [], GLOBAL)?.merchantId).toBe('g1')
  })
})

describe('extractMerchant — precedência', () => {
  it('merchant do usuário vence o global', () => {
    const userMerchants: MerchantRecord[] = [
      { id: 'u1', name: 'Padaria do João', slug: 'padariadojoao', aliases: ['padaria'], categoryId: 'cat-user', defaultType: TransactionType.EXPENSE },
    ]
    const m = extractMerchant('padaria 12', userMerchants, GLOBAL)
    expect(m?.merchantId).toBe('u1')
    expect(m?.fromUser).toBe(true)
  })

  it('escolhe o candidato mais longo ("mercado livre" sobre nada genérico)', () => {
    const m = extractMerchant('comprei no mercado livre 200', [], GLOBAL)
    expect(m?.merchantId).toBe('g3')
    expect(m?.matched).toBe('mercado livre')
  })
})
