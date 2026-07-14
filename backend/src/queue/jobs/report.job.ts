// =============================================================================
// FinIA — Job da fila report.generator
// =============================================================================
//
// A linha em `reports` já existe (status PENDING) quando o job entra na fila;
// o worker a promove para GENERATING → COMPLETED/FAILED.
//
// =============================================================================

export const REPORT_JOB_NAME = 'generate'

export interface ReportJobData {
  reportId: string
}
