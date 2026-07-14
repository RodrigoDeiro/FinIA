import { parseBRLToNumber, round2 } from '@shared/utils/currency.util.js'
import type { ExtractedAmount } from '../types/parse-result.type.js'

// =============================================================================
// FinIA — Amount Extractor
// =============================================================================
//
// Extrai um valor monetário de uma mensagem em português brasileiro.
// Estratégias, em ordem de prioridade (a primeira que casar vence):
//
//   1. "X mil"          → "2 mil" = 2000 ; "1,5 mil" = 1500
//   2. "R$ X"           → "R$ 89,90", "R$89,90"
//   3. "X reais|conto"  → "89 reais", "50 conto", "30 pila"
//   4. número solto     → "Mercado 89,90", "uber 25"
//
// A conversão numérica fina (vírgula/ponto) fica no currency.util.
//
// =============================================================================

// Um "número brasileiro": dígitos com pontos de milhar e/ou vírgula decimal.
const NUMBER = '\\d[\\d.,]*'

const MIL_RE = new RegExp(`(${NUMBER})\\s*mil\\b`, 'i')
const CURRENCY_RE = new RegExp(`r\\$\\s*(${NUMBER})`, 'i')
const UNIT_RE = new RegExp(`(${NUMBER})\\s*(?:reais|real|conto|contos|pila|paus|mangos?)\\b`, 'i')
const BARE_RE = new RegExp(`(?:^|\\s)(${NUMBER})(?=\\s|$)`)

/** Converte um valor positivo plausível ou retorna null. */
function toPositive(value: number | null): number | null {
  if (value === null) return null
  const rounded = round2(value)
  return rounded > 0 ? rounded : null
}

export function extractAmount(text: string): ExtractedAmount | null {
  // 1. "X mil"
  const mil = text.match(MIL_RE)
  if (mil?.[1]) {
    const base = parseBRLToNumber(mil[1])
    const value = toPositive(base === null ? null : base * 1000)
    if (value !== null) return { value, raw: mil[0].trim() }
  }

  // 2. "R$ X"
  const currency = text.match(CURRENCY_RE)
  if (currency?.[1]) {
    const value = toPositive(parseBRLToNumber(currency[1]))
    if (value !== null) return { value, raw: currency[0].trim() }
  }

  // 3. "X reais|conto|pila"
  const unit = text.match(UNIT_RE)
  if (unit?.[1]) {
    const value = toPositive(parseBRLToNumber(unit[1]))
    if (value !== null) return { value, raw: unit[0].trim() }
  }

  // 4. número solto
  const bare = text.match(BARE_RE)
  if (bare?.[1]) {
    const value = toPositive(parseBRLToNumber(bare[1]))
    if (value !== null) return { value, raw: bare[1].trim() }
  }

  return null
}
