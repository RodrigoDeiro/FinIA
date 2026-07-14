// =============================================================================
// FinIA — Jobs da fila insight.generator
// =============================================================================
//
// Dois tipos de job na mesma fila:
//   - FANOUT (cron semanal): sem userId — o worker enumera usuários ativos e
//     enfileira um job individual por usuário (§7.3).
//   - GENERATE: roda o InsightEngine para UM usuário.
//
// =============================================================================

export const INSIGHT_FANOUT_JOB_NAME = 'fanout'
export const INSIGHT_JOB_NAME = 'generate'

export interface InsightJobData {
  userId: string
  trigger: 'cron' | 'demand'
}
