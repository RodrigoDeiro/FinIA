import 'fastify'
import '@fastify/jwt'

// =============================================================================
// FinIA — Augmentação de tipos do Fastify
// =============================================================================
//
// 1. `rawBody`: corpo BRUTO da requisição para validar HMAC do webhook — o
//    parser customizado em whatsapp.routes.ts o preenche.
// 2. `auth`: identidade autenticada da requisição (preenchida pelo guard).
// 3. `authenticate`: decorator registrado pelo auth.module (guard de rotas).
// 4. FastifyJWT: shape do payload do access token (sub = sessionId — decisão
//    aprovada §4 — e uid = userId).
//
// =============================================================================

declare module 'fastify' {
  interface FastifyRequest {
    /** Corpo bruto da requisição como string (preenchido para rotas de webhook) */
    rawBody?: string
    /** Identidade autenticada (preenchida pelo guard `authenticate`) */
    auth?: { userId: string; sessionId: string }
  }

  interface FastifyInstance {
    /** Guard de autenticação: use como preHandler em rotas protegidas */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; uid: string }
    user: { sub: string; uid: string }
  }
}
