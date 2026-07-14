import { describe, it, expect } from 'vitest'
import { parseDurationMs } from '@shared/utils/duration.util.js'

// =============================================================================
// FinIA — Testes: Duration Util
// =============================================================================

describe('parseDurationMs', () => {
  const cases: Array<[string, number]> = [
    ['45s', 45_000],
    ['15m', 900_000],
    ['1h', 3_600_000],
    ['30d', 2_592_000_000],
    ['500ms', 500],
    [' 2h ', 7_200_000], // com espaços
  ]

  it.each(cases)('"%s" → %d ms', (input, expected) => {
    expect(parseDurationMs(input)).toBe(expected)
  })

  it.each(['', 'abc', '10', '1w', 'h1'])('lança em formato inválido: "%s"', (input) => {
    expect(() => parseDurationMs(input)).toThrow(/Duração inválida/)
  })
})
