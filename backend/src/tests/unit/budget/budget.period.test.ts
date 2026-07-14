import { describe, it, expect } from 'vitest'
import { currentPeriodWindow } from '@modules/budget/budget.period.js'
import { dayjs } from '@shared/utils/date.util.js'

// =============================================================================
// FinIA — Testes: janela de período do orçamento
// =============================================================================

const TZ = 'America/Sao_Paulo'

describe('currentPeriodWindow', () => {
  it('MONTHLY → 1º ao último dia do mês corrente', () => {
    const w = currentPeriodWindow('MONTHLY', TZ)
    const start = dayjs.utc(w.start).tz(TZ)
    const end = dayjs.utc(w.end).tz(TZ)
    const now = dayjs().tz(TZ)
    expect(start.date()).toBe(1)
    expect(start.month()).toBe(now.month())
    expect(end.month()).toBe(now.month())
    expect(w.key).toBe(now.format('YYYY-MM'))
    expect(w.label).toBe('neste mês')
  })

  it('WEEKLY → começa na segunda, termina no domingo', () => {
    const w = currentPeriodWindow('WEEKLY', TZ)
    const start = dayjs.utc(w.start).tz(TZ)
    const end = dayjs.utc(w.end).tz(TZ)
    expect(start.day()).toBe(1) // segunda
    expect(end.day()).toBe(0) // domingo
    expect(end.diff(start, 'day')).toBe(6)
  })

  it('YEARLY → ano corrente inteiro', () => {
    const w = currentPeriodWindow('YEARLY', TZ)
    const start = dayjs.utc(w.start).tz(TZ)
    const now = dayjs().tz(TZ)
    expect(start.month()).toBe(0)
    expect(start.date()).toBe(1)
    expect(w.key).toBe(String(now.year()))
  })

  it('chaves de períodos diferentes são distintas (dedupe de alerta)', () => {
    const m = currentPeriodWindow('MONTHLY', TZ)
    const y = currentPeriodWindow('YEARLY', TZ)
    expect(m.key).not.toBe(y.key)
  })
})
