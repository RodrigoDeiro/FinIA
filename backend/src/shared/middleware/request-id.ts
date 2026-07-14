import type { IncomingMessage } from 'node:http'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { randomToken } from '@shared/utils/crypto.util.js'

// =============================================================================
// FinIA — Request ID
// =============================================================================
//
// Correlação de logs por requisição. genReqId reaproveita um x-request-id
// recebido (útil quando há um proxy/gateway na frente) ou gera um id curto.
// O plugin ecoa o id no header da resposta para o cliente conseguir correlacionar.
//
// =============================================================================

/** Gera (ou reaproveita) o id da requisição. Passado ao Fastify em app.ts. */
export function genReqId(req: IncomingMessage): string {
  const incoming = req.headers['x-request-id']
  if (typeof incoming === 'string' && incoming.length > 0) return incoming
  return randomToken(8)
}

/** Ecoa o request id no header da resposta. */
export const requestIdPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id)
  })
})
