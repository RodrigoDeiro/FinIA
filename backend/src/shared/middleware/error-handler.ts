import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '@shared/errors/index.js'
import { isProduction } from '@config/env.js'

// =============================================================================
// FinIA — Error Handler global
// =============================================================================
//
// Converte qualquer erro em uma resposta JSON padronizada:
//   { error: { code, message, details? } }
//
//   - AppError (e subclasses) → usa statusCode e code do próprio erro.
//   - Erros do Fastify (validação, 404) → usa o statusCode deles.
//   - Inesperados → 500 e, em produção, mensagem genérica (nunca vaza stack).
//
// =============================================================================

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Erros do domínio (previstos)
  if (error instanceof AppError) {
    request.log.warn({ err: error, code: error.code }, error.message)
    void reply.code(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    })
    return
  }

  const fastifyError = error as FastifyError
  const statusCode =
    typeof fastifyError.statusCode === 'number' ? fastifyError.statusCode : 500

  if (statusCode >= 500) {
    request.log.error({ err: error }, 'Erro não tratado')
  } else {
    request.log.warn({ err: error }, error.message)
  }

  void reply.code(statusCode).send({
    error: {
      code: fastifyError.code ?? 'INTERNAL_ERROR',
      // Em produção, 5xx não revela detalhes internos.
      message:
        statusCode >= 500 && isProduction ? 'Erro interno do servidor' : error.message,
    },
  })
}
