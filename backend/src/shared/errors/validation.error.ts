import { AppError } from './app.error.js'

// =============================================================================
// FinIA — Erro de Validação
// =============================================================================
//
// Lançado quando dados de entrada falham na validação (Zod, regras de negócio).
// statusCode 422 (Unprocessable Entity): a requisição é sintaticamente válida
// mas semanticamente inválida.
//
// `details` carrega a lista de problemas (ex: issues achatadas do Zod) para
// o cliente saber exatamente quais campos corrigir.
//
// =============================================================================

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', true, details)
  }
}
