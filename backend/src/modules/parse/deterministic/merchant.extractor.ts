import type { ExtractedMerchant } from '../types/parse-result.type.js'
import type { MerchantRecord } from './merchant-db/merchant.db.js'

// =============================================================================
// FinIA — Merchant Extractor
// =============================================================================
//
// Procura, no texto, um merchant conhecido. Para cada merchant, monta uma lista
// de "candidatos" (slug, nome normalizado, aliases) e testa se algum aparece
// como palavra inteira no texto normalizado.
//
// Precedência:
//   1. merchants do usuário (mais específicos / aprendidos)
//   2. merchants globais
//   Dentro de cada escopo, o candidato MAIS LONGO vence (ex: "mercado livre"
//   prevalece sobre "mercado", evitando categorização genérica demais).
//
// Normalização: minúsculas, sem acento, espaços colapsados.
//
// =============================================================================

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Escapa caracteres especiais de regex (ex: '+', '.', '$'). */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Candidatos de match de um merchant, normalizados e sem duplicatas vazias. */
function candidatesOf(m: MerchantRecord): string[] {
  const list = [m.slug, normalize(m.name), ...m.aliases.map(normalize)]
  return Array.from(new Set(list.map((c) => c.trim()).filter((c) => c.length >= 2)))
}

function findIn(
  haystack: string,
  merchants: MerchantRecord[],
  fromUser: boolean,
): ExtractedMerchant | null {
  let best: ExtractedMerchant | null = null

  for (const m of merchants) {
    for (const cand of candidatesOf(m)) {
      const re = new RegExp(`\\b${escapeRegex(cand)}\\b`)
      if (re.test(haystack)) {
        if (!best || cand.length > best.matched.length) {
          best = {
            merchantId: m.id,
            name: m.name,
            categoryId: m.categoryId,
            defaultType: m.defaultType,
            matched: cand,
            fromUser,
          }
        }
      }
    }
  }

  return best
}

export function extractMerchant(
  text: string,
  userMerchants: MerchantRecord[],
  globalMerchants: MerchantRecord[],
): ExtractedMerchant | null {
  const haystack = normalize(text)
  // Usuário primeiro; só cai para globais se nada casar entre os do usuário.
  return findIn(haystack, userMerchants, true) ?? findIn(haystack, globalMerchants, false)
}
