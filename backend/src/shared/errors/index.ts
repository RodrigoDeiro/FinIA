// =============================================================================
// FinIA — Barrel de Erros
// =============================================================================
// Reexporta todos os erros do domínio para imports limpos:
//   import { AppError, ValidationError, NotFoundError } from '@shared/errors/index.js'
// =============================================================================

export { AppError } from './app.error.js'
export { ValidationError } from './validation.error.js'
export { NotFoundError } from './not-found.error.js'
export { WebhookError } from './webhook.error.js'
