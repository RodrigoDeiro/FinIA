// =============================================================================
// FinIA — Tipos compartilhados
// =============================================================================
// Tipos utilitários genéricos usados em vários módulos.
// =============================================================================

/** T ou null — torna explícita a possibilidade de ausência. */
export type Nullable<T> = T | null

/** Torna todas as propriedades de T opcionais e anuláveis (entradas parciais). */
export type PartialNullable<T> = {
  [K in keyof T]?: T[K] | null
}
