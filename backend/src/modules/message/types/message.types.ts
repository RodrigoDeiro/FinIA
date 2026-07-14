// =============================================================================
// FinIA — Tipos do módulo Message
// =============================================================================

/** Comandos reconhecidos (texto não-transacional). */
export type CommandKind = 'help' | 'greeting' | 'dashboard'

/**
 * Resultado do roteamento:
 *   command → resposta fixa (ajuda, saudação, dashboard)
 *   query   → consulta financeira ("quanto gastei esse mês")
 *   text    → texto livre (provável transação → parser)
 */
export type DetectedMessage =
  | { kind: 'command'; command: CommandKind }
  | { kind: 'query' }
  | { kind: 'text' }
