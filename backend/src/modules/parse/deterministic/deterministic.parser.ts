import { extractAmount } from './amount.extractor.js'
import { extractIntent } from './intent.extractor.js'
import { extractDate } from './date.extractor.js'
import { extractMerchant } from './merchant.extractor.js'
import { calculateConfidence } from './confidence.calculator.js'
import type { MerchantRecord } from './merchant-db/merchant.db.js'
import type { DeterministicParseResult } from '../types/parse-result.type.js'

// =============================================================================
// FinIA — Deterministic Parser
// =============================================================================
//
// Orquestra os 4 extractors (amount, intent, date, merchant), define o tipo
// final e calcula a confiança. Função PURA: recebe a lista de merchants por
// parâmetro (carregada antes pelo orchestrator), o que a torna trivialmente
// testável sem banco — base da cobertura ≥85% exigida no Parse Module.
//
// =============================================================================

export interface ParseContext {
  timezone: string
  userMerchants: MerchantRecord[]
  globalMerchants: MerchantRecord[]
}

// Palavras que NÃO contam como "descrição útil" (preposições, unidades, datas).
const STOPWORDS = new Set([
  'reais', 'real', 'conto', 'contos', 'pila', 'paus', 'mango', 'mangos', 'mil',
  'de', 'do', 'da', 'no', 'na', 'em', 'com', 'pra', 'para', 'por',
  'hoje', 'ontem', 'anteontem', 'dia',
])

/**
 * Há texto descritivo relevante além do valor e das palavras-chave?
 * Se um merchant foi reconhecido, a resposta é trivialmente sim.
 */
function hasContextText(
  text: string,
  amountRaw: string | null,
  intentKeyword: string | null,
  merchantMatched: boolean,
): boolean {
  if (merchantMatched) return true

  let leftover = text.toLowerCase()
  if (amountRaw) leftover = leftover.split(amountRaw.toLowerCase()).join(' ')
  if (intentKeyword) leftover = leftover.split(intentKeyword).join(' ')

  const tokens =
    leftover
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .match(/[a-z]{2,}/g) ?? []

  return tokens.some((t) => !STOPWORDS.has(t))
}

export function parseDeterministic(text: string, ctx: ParseContext): DeterministicParseResult {
  const amount = extractAmount(text)
  const intent = extractIntent(text)
  const merchant = extractMerchant(text, ctx.userMerchants, ctx.globalMerchants)
  const date = extractDate(text, ctx.timezone)

  // Tipo final: palavra-chave explícita vence; senão o default do merchant;
  // senão o default geral (EXPENSE, já embutido em intent.type).
  const type = intent.explicit ? intent.type : (merchant?.defaultType ?? intent.type)

  const components = {
    hasAmount: amount !== null,
    hasType: intent.explicit,
    hasMerchant: merchant !== null,
    hasContext: hasContextText(text, amount?.raw ?? null, intent.matchedKeyword, merchant !== null),
  }

  return {
    amount: amount?.value ?? null,
    type,
    date: date.date,
    merchantName: merchant?.name ?? null,
    merchantId: merchant?.merchantId ?? null,
    categoryId: merchant?.categoryId ?? null,
    description: text.trim(),
    confidence: calculateConfidence(components),
    components,
  }
}
