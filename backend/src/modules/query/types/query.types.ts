// =============================================================================
// FinIA — Tipos do módulo Query
// =============================================================================

/** Métrica que a consulta pede. */
export type QueryMetric =
  | 'EXPENSE_SUM' // "quanto gastei"
  | 'INCOME_SUM' // "quanto recebi"
  | 'BALANCE' // "saldo", "quanto sobrou"
  | 'SUMMARY' // "resumo", "extrato"
  | 'TOP_CATEGORIES' // "onde gastei mais"

/** Período resolvido da consulta (em UTC, interpretado no fuso do usuário). */
export interface QueryPeriod {
  start: Date
  end: Date
  /** Rótulo em português para a resposta (ex: "neste mês", "ontem") */
  label: string
  /** true se o usuário mencionou o período explicitamente */
  explicit: boolean
}

/** Consulta estruturada resolvida deterministicamente. */
export interface DeterministicQuery {
  metric: QueryMetric
  period: QueryPeriod
  /** Filtro de categoria (slug do sistema), quando aplicável */
  categorySlug: string | null
}
