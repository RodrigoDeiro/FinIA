import { detectCommand } from './command/command.detector.js'
import { isFinancialQuery } from '@modules/query/deterministic/query.detector.js'
import type { DetectedMessage } from './types/message.types.js'

// =============================================================================
// FinIA — Message Router
// =============================================================================
//
// Decide o caminho de uma mensagem de texto, nesta ordem:
//
//   1. Comando (oi, ajuda, dashboard)  → resposta fixa
//   2. Consulta financeira (Sprint 2)  → query orchestrator
//   3. Texto livre                     → parser de transação
//
// A ordem importa: "quanto gastei esse mês" contém "gastei" (verbo de EXPENSE),
// mas a interrogativa a marca como consulta ANTES de chegar ao parser.
//
// =============================================================================

export function routeMessage(text: string): DetectedMessage {
  const command = detectCommand(text)
  if (command.kind === 'command') return command

  if (isFinancialQuery(text)) return { kind: 'query' }

  return { kind: 'text' }
}
