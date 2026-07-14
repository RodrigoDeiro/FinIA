// =============================================================================
// FinIA — Utilitários de Moeda
// =============================================================================
//
// Conversão entre texto livre brasileiro e número, e formatação de volta.
//
// Desafio: o separador decimal no Brasil é a vírgula e o de milhar é o ponto:
//   "1.234,56"  → 1234.56
//   "89,90"     → 89.90
//   "1.500"     → 1500    (ponto de milhar, NÃO decimal)
//   "89.90"     → 89.90   (formato com ponto decimal — aceito também)
//
// Esta camada faz só a conversão numérica de baixo nível. A varredura da
// mensagem (regex "R$ X", "X reais", "X mil") fica no amount.extractor.
//
// =============================================================================

/**
 * Converte um texto numérico brasileiro em número.
 * Retorna null se a string não contiver um número reconhecível.
 *
 * Heurística do separador decimal:
 *   - tem vírgula E ponto → o que aparecer por último é o decimal
 *   - só vírgula          → vírgula é decimal
 *   - só ponto            → decimal se 1–2 casas depois; milhar se grupos de 3
 */
export function parseBRLToNumber(raw: string): number | null {
  // Remove "R$", espaços e qualquer caractere que não seja dígito, ponto ou vírgula
  let s = raw
    .toLowerCase()
    .replace(/r\$/g, '')
    .replace(/\s/g, '')
    .replace(/[^0-9.,]/g, '')

  if (!s) return null

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // vírgula é o decimal → pontos são milhar
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // ponto é o decimal → vírgulas são milhar
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    // só vírgula → decimal
    s = s.replace(',', '.')
  } else if (hasDot) {
    // só ponto: grupos de exatamente 3 dígitos = milhar; senão = decimal
    const groups = s.split('.').slice(1)
    const allGroupsOfThree = groups.every((g) => g.length === 3)
    if (allGroupsOfThree) {
      s = s.replace(/\./g, '')
    } else {
      // o último ponto é o decimal; pontos anteriores (se houver) são milhar
      const lastDot = s.lastIndexOf('.')
      s = s.slice(0, lastDot).replace(/\./g, '') + '.' + s.slice(lastDot + 1)
    }
  }

  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Arredonda para 2 casas decimais (precisão de centavos) evitando o erro
 * clássico de ponto flutuante (ex: 1.005 → 1.00). O +Number.EPSILON empurra
 * valores no limite para o lado correto antes do arredondamento.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Formata um número como moeda brasileira: 1234.5 → "R$ 1.234,50".
 */
export function formatBRL(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value)
}
