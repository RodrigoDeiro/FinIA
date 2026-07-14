import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyJwt from '@fastify/jwt'
import { env, assertAuthEnv } from '@config/env.js'
import { AUTH_COOKIES } from '@config/constants.js'
import { logger } from '@config/logger.js'
import { openTenantScope, setTenantUserId } from '@database/tenant.context.js'
import { getLiveSession } from './session.service.js'
import { authRoutes } from './auth.routes.js'

// =============================================================================
// FinIA — Módulo Auth
// =============================================================================
//
// Inicialização (fast fail no módulo, não no boot global — anti-padrão #4):
//   1. assertAuthEnv → JWT_SECRET presente e forte.
//   2. Registra @fastify/cookie e @fastify/jwt (JWT lido do cookie httpOnly).
//   3. Decora `app.authenticate` — o guard usado por toda rota protegida:
//        - verifica assinatura/expiração do JWT (cookie)
//        - confirma que a SESSÃO (sub) continua viva no banco → revogação
//          tem efeito imediato, mesmo com JWT ainda válido
//        - preenche request.auth e entra no contexto de tenant (ALS)
//
// =============================================================================

export async function registerAuthModule(app: FastifyInstance): Promise<void> {
  assertAuthEnv(env) // JWT_SECRET vira `string` daqui em diante

  await app.register(fastifyCookie)
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: AUTH_COOKIES.ACCESS, signed: false },
  })

  // Abre o escopo de tenant para TODA requisição (forma callback — obrigatória:
  // done() dentro do als.run é o que faz o contexto envolver todo o ciclo).
  // No Node 24, enterWith() dentro de hook async NÃO propaga para o handler.
  app.addHook('onRequest', (_request, _reply, done) => openTenantScope(done))

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply
        .code(401)
        .send({ error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária' } })
    }

    const { sub: sessionId, uid: userId } = request.user

    // Sessão precisa continuar viva — revogação vale na hora, não no expiry do JWT
    const session = await getLiveSession(sessionId)
    if (!session || session.userId !== userId) {
      return reply
        .code(401)
        .send({ error: { code: 'UNAUTHORIZED', message: 'Sessão encerrada' } })
    }

    request.auth = { userId, sessionId }
    // Isolamento de tenant: muta o store aberto no onRequest — daqui em diante
    // o tenantPrisma filtra por este usuário
    setTenantUserId(userId)
  })

  await app.register(authRoutes, { prefix: '/api/v1/auth' })
  logger.info('Módulo Auth registrado (magic link + JWT em cookie + rotação de refresh)')
}
