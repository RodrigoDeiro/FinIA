import { AppError } from './app.error.js'

// =============================================================================
// FinIA — Erro de Recurso Não Encontrado
// =============================================================================
//
// Lançado quando um recurso referenciado não existe (usuário, transação,
// categoria, etc.). statusCode 404.
//
//   new NotFoundError('Transação', txId)
//   → "Transação não encontrada: ckxyz..."
//
// =============================================================================

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso', id?: string) {
    const message = id
      ? `${resource} não encontrado: ${id}`
      : `${resource} não encontrado`
    super(message, 404, 'NOT_FOUND', true, { resource, id })
  }
}
