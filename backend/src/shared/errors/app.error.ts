// =============================================================================
// FinIA — Erro Base da Aplicação
// =============================================================================
//
// Todos os erros "esperados" (operacionais) do domínio estendem AppError.
// O error-handler global (src/shared/middleware/error-handler.ts) usa
// statusCode e code para montar uma resposta JSON padronizada, sem vazar
// stack trace em produção.
//
//   isOperational = true  → erro previsto (validação, not found, etc.)
//                           seguro responder ao cliente.
//   isOperational = false → bug inesperado → 500 genérico em produção.
//
// =============================================================================

export class AppError extends Error {
  /** Código HTTP a retornar (ex: 400, 404, 422, 500) */
  readonly statusCode: number

  /** Identificador estável legível por máquina (ex: 'VALIDATION_ERROR') */
  readonly code: string

  /** true = erro previsto do domínio; false = bug inesperado */
  readonly isOperational: boolean

  /** Detalhes extras opcionais (ex: issues do Zod) — nunca expostos em prod se sensíveis */
  readonly details?: unknown

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    isOperational = true,
    details?: unknown,
  ) {
    super(message)

    // Necessário ao estender Error em TypeScript com target ES2023:
    // restaura a cadeia de protótipos para que instanceof funcione.
    Object.setPrototypeOf(this, new.target.prototype)

    this.name = new.target.name
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational
    this.details = details

    // Remove o construtor do stack trace (Node) para logs mais limpos
    Error.captureStackTrace?.(this, new.target)
  }
}
