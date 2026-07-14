import { describe, it, expect } from 'vitest'
import { parseQueryDeterministic } from '@modules/query/deterministic/deterministic-query.parser.js'

// =============================================================================
// FinIA — Testes: Deterministic Query Parser
// =============================================================================

const TZ = 'America/Sao_Paulo'
const SLUGS = [
  'alimentacao', 'transporte', 'moradia', 'saude', 'educacao', 'lazer',
  'assinaturas', 'investimentos', 'receitas', 'impostos', 'compras', 'outros',
]

describe('parseQueryDeterministic', () => {
  it('mapeia métrica + período + categoria', () => {
    const q = parseQueryDeterministic('quanto gastei com alimentação esse mês', TZ, SLUGS)
    expect(q?.metric).toBe('EXPENSE_SUM')
    expect(q?.categorySlug).toBe('alimentacao')
    expect(q?.period.explicit).toBe(true)
  })

  it('resolve sinônimo de categoria ("comida" → alimentacao)', () => {
    const q = parseQueryDeterministic('quanto gastei com comida', TZ, SLUGS)
    expect(q?.categorySlug).toBe('alimentacao')
  })

  it('sem categoria mencionada → filtro null', () => {
    expect(parseQueryDeterministic('quanto gastei', TZ, SLUGS)?.categorySlug).toBeNull()
  })

  it('não aplica filtro de categoria a receitas', () => {
    // "receitas" é slug, mas INCOME_SUM não filtra por categoria
    const q = parseQueryDeterministic('quanto recebi esse mês', TZ, SLUGS)
    expect(q?.metric).toBe('INCOME_SUM')
    expect(q?.categorySlug).toBeNull()
  })

  it('consulta complexa → null (vai para a IA)', () => {
    expect(parseQueryDeterministic('estou gastando muito?', TZ, SLUGS)).toBeNull()
  })

  it('"quanto gastei com transporte ontem" → tudo junto', () => {
    const q = parseQueryDeterministic('quanto gastei com transporte ontem', TZ, SLUGS)
    expect(q).toMatchObject({
      metric: 'EXPENSE_SUM',
      categorySlug: 'transporte',
      period: { label: 'ontem', explicit: true },
    })
  })
})
