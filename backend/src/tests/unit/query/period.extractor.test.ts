import { describe, it, expect } from 'vitest'
import { extractQueryPeriod } from '@modules/query/deterministic/period.extractor.js'
import { dayjs } from '@shared/utils/date.util.js'

// =============================================================================
// FinIA — Testes: Period Extractor (consultas)
// =============================================================================

const TZ = 'America/Sao_Paulo'

describe('extractQueryPeriod', () => {
  it('"hoje" → início do dia local até agora', () => {
    const p = extractQueryPeriod('quanto gastei hoje', TZ)
    expect(p.explicit).toBe(true)
    expect(p.label).toBe('hoje')
    const local = dayjs.utc(p.start).tz(TZ)
    expect(local.hour()).toBe(0)
    expect(local.date()).toBe(dayjs().tz(TZ).date())
  })

  it('"ontem" → dia anterior completo', () => {
    const p = extractQueryPeriod('quanto gastei ontem', TZ)
    expect(p.label).toBe('ontem')
    const start = dayjs.utc(p.start).tz(TZ)
    const end = dayjs.utc(p.end).tz(TZ)
    expect(start.date()).toBe(dayjs().tz(TZ).subtract(1, 'day').date())
    expect(end.diff(start, 'hour')).toBeGreaterThanOrEqual(23)
  })

  it('"mês passado" → primeiro ao último dia do mês anterior', () => {
    const p = extractQueryPeriod('resumo do mês passado', TZ)
    expect(p.label).toBe('no mês passado')
    const start = dayjs.utc(p.start).tz(TZ)
    const expected = dayjs().tz(TZ).subtract(1, 'month')
    expect(start.date()).toBe(1)
    expect(start.month()).toBe(expected.month())
  })

  it('"essa semana" → começa na segunda-feira', () => {
    const p = extractQueryPeriod('quanto gastei essa semana', TZ)
    expect(p.label).toBe('nesta semana')
    const start = dayjs.utc(p.start).tz(TZ)
    expect(start.day()).toBe(1) // 1 = segunda
  })

  it('"semana passada" → segunda a domingo anteriores', () => {
    const p = extractQueryPeriod('gastos da semana passada', TZ)
    const start = dayjs.utc(p.start).tz(TZ)
    const end = dayjs.utc(p.end).tz(TZ)
    expect(start.day()).toBe(1)
    expect(end.day()).toBe(0) // domingo
    expect(end.isBefore(dayjs())).toBe(true)
  })

  it('sem menção → mês corrente (não explícito)', () => {
    const p = extractQueryPeriod('quanto gastei', TZ)
    expect(p.explicit).toBe(false)
    expect(p.label).toBe('neste mês')
    expect(dayjs.utc(p.start).tz(TZ).date()).toBe(1)
  })
})
