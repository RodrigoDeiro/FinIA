import { normalizeText } from '@shared/utils/text.util.js'
import { detectQueryMetric } from './query.detector.js'
import { extractQueryPeriod } from './period.extractor.js'
import type { DeterministicQuery } from '../types/query.types.js'

// =============================================================================
// FinIA — Deterministic Query Parser
// =============================================================================
//
// Combina métrica + período + filtro de categoria em uma consulta estruturada.
// Retorna null quando a métrica não é mapeável — o orquestrador cai para a IA.
//
// Filtro de categoria: aplicado APENAS a somas de gasto (EXPENSE_SUM). Filtrar
// receitas por categoria produziria zeros enganosos (receitas costumam cair na
// categoria fallback "outros"), e resumos/saldos são globais por natureza.
//
// =============================================================================

// Sinônimos comuns → slug de categoria do sistema
const CATEGORY_ALIASES: Record<string, string> = {
  comida: 'alimentacao',
  mercado: 'alimentacao',
  restaurante: 'alimentacao',
  farmacia: 'saude',
  remedio: 'saude',
  aluguel: 'moradia',
  streaming: 'assinaturas',
}

// Slugs que não fazem sentido como filtro de GASTO
const EXCLUDED_EXPENSE_SLUGS = new Set(['receitas', 'outros'])

/** Procura um slug de categoria (ou sinônimo) citado no texto. */
function extractCategorySlug(text: string, categorySlugs: string[]): string | null {
  const t = normalizeText(text)

  for (const slug of categorySlugs) {
    if (EXCLUDED_EXPENSE_SLUGS.has(slug)) continue
    if (new RegExp(`\\b${slug}\\b`).test(t)) return slug
  }

  for (const [alias, slug] of Object.entries(CATEGORY_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(t) && categorySlugs.includes(slug)) return slug
  }

  return null
}

export function parseQueryDeterministic(
  text: string,
  timezone: string,
  categorySlugs: string[],
): DeterministicQuery | null {
  const metric = detectQueryMetric(text)
  if (!metric) return null

  const period = extractQueryPeriod(text, timezone)
  const categorySlug =
    metric === 'EXPENSE_SUM' ? extractCategorySlug(text, categorySlugs) : null

  return { metric, period, categorySlug }
}
