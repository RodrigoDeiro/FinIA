// =============================================================================
// FinIA — Utilitários de Texto
// =============================================================================

/**
 * Normaliza texto para matching: minúsculas, sem acentos, espaços colapsados.
 * (Extractors mais antigos têm uma cópia privada desta função; módulos novos
 * devem importar daqui.)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}
