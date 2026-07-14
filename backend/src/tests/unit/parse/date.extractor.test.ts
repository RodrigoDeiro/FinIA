import { describe, it, expect } from 'vitest'
import { extractDate } from '@modules/parse/deterministic/date.extractor.js'
import { dayjs } from '@shared/utils/date.util.js'

// =============================================================================
// FinIA — Testes: Date Extractor
// =============================================================================

const TZ = 'America/Sao_Paulo'

describe('extractDate — relativas', () => {
  it('"hoje" é explícito', () => {
    const r = extractDate('gastei 50 hoje', TZ)
    expect(r.explicit).toBe(true)
    expect(r.raw).toBe('hoje')
  })

  it('"ontem" é 24h antes de "hoje"', () => {
    const hoje = extractDate('hoje', TZ).date
    const ontem = extractDate('ontem', TZ).date
    const diffHoras = (hoje.getTime() - ontem.getTime()) / 3_600_000
    expect(diffHoras).toBe(24)
  })

  it('"anteontem" é 48h antes de "hoje"', () => {
    const hoje = extractDate('hoje', TZ).date
    const anteontem = extractDate('anteontem', TZ).date
    expect((hoje.getTime() - anteontem.getTime()) / 3_600_000).toBe(48)
  })
})

describe('extractDate — numéricas', () => {
  it('interpreta DD/MM no fuso do usuário', () => {
    const r = extractDate('uber 25 dia 15/03', TZ)
    expect(r.explicit).toBe(true)
    const local = dayjs.utc(r.date).tz(TZ)
    expect(local.date()).toBe(15)
    expect(local.month() + 1).toBe(3)
  })

  it('aceita DD/MM/YYYY', () => {
    const r = extractDate('paguei 100 em 10/01/2020', TZ)
    const local = dayjs.utc(r.date).tz(TZ)
    expect(local.date()).toBe(10)
    expect(local.month() + 1).toBe(1)
    expect(local.year()).toBe(2020)
  })

  it('ignora data inválida (31/02) e cai no default', () => {
    const r = extractDate('31/02', TZ)
    expect(r.explicit).toBe(false)
  })
})

describe('extractDate — sem data', () => {
  it('assume agora (não explícito)', () => {
    const r = extractDate('Mercado 89,90', TZ)
    expect(r.explicit).toBe(false)
    expect(r.raw).toBeNull()
  })
})
