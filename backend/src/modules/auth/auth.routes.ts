import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@database/prisma.js'
import { env } from '@config/env.js'
import { AUTH_COOKIES } from '@config/constants.js'
import { parseDurationMs } from '@shared/utils/duration.util.js'
import { consumeMagicLink } from './magic-link.service.js'
import {
  createSession,
  verifyAndRotate,
  revokeSession,
  listActiveSessions,
} from './session.service.js'
import { setAuthCookies, clearAuthCookies } from './auth.cookies.js'

// =============================================================================
// FinIA — Rotas de Autenticação (/api/v1/auth)
// =============================================================================
//
//   POST /magic               troca o token do magic link por sessão + cookies
//   POST /refresh             rotaciona o refresh token e renova o access JWT
//   POST /logout              revoga a sessão corrente e limpa cookies
//   GET  /sessions            lista sessões ativas (protegida)
//   POST /sessions/:id/revoke revoga uma sessão específica (protegida)
//
// Respostas de falha de auth são SEMPRE 401 genérico — não revelamos se o
// token era inválido, expirado ou reutilizado (isso é informação para atacante).
//
// =============================================================================

const magicBodySchema = z.object({ token: z.string().min(32) })

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const accessTtlMs = parseDurationMs(env.JWT_EXPIRES_IN)

  function signAccessToken(sessionId: string, userId: string): string {
    return app.jwt.sign({ sub: sessionId, uid: userId }, { expiresIn: accessTtlMs })
  }

  // ─── POST /magic — login via magic link ────────────────────────────────────
  app.post('/magic', async (request, reply) => {
    const parsed = magicBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(401).send({ error: { code: 'INVALID_TOKEN', message: 'Link inválido ou expirado' } })
    }

    const userId = await consumeMagicLink(parsed.data.token)
    if (!userId) {
      return reply.code(401).send({ error: { code: 'INVALID_TOKEN', message: 'Link inválido ou expirado' } })
    }

    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
    if (!user) {
      return reply.code(401).send({ error: { code: 'INVALID_TOKEN', message: 'Link inválido ou expirado' } })
    }

    const { session, refreshToken } = await createSession(userId, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })

    setAuthCookies(reply, signAccessToken(session.id, userId), refreshToken)
    return reply.code(200).send({
      user: { id: user.id, name: user.name, phoneNumber: user.phoneNumber, currency: user.currency, timezone: user.timezone },
    })
  })

  // ─── POST /refresh — rotação do refresh token ──────────────────────────────
  app.post('/refresh', async (request, reply) => {
    const raw = request.cookies[AUTH_COOKIES.REFRESH]
    if (!raw) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sessão inválida' } })
    }

    const rotated = await verifyAndRotate(raw)
    if (!rotated) {
      clearAuthCookies(reply)
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sessão inválida' } })
    }

    setAuthCookies(reply, signAccessToken(rotated.session.id, rotated.session.userId), rotated.refreshToken)
    return reply.code(204).send()
  })

  // ─── POST /logout — revoga a sessão corrente ───────────────────────────────
  app.post('/logout', { preHandler: [app.authenticate] }, async (request, reply) => {
    await revokeSession(request.auth!.sessionId, 'logout')
    clearAuthCookies(reply)
    return reply.code(204).send()
  })

  // ─── GET /sessions — sessões ativas do usuário ─────────────────────────────
  app.get('/sessions', { preHandler: [app.authenticate] }, async (request) => {
    const sessions = await listActiveSessions(request.auth!.userId)
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        current: s.id === request.auth!.sessionId,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
      })),
    }
  })

  // ─── POST /sessions/:id/revoke — revogação granular ────────────────────────
  app.post('/sessions/:id/revoke', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    // Só revoga sessões do PRÓPRIO usuário
    const owned = await prisma.session.findFirst({
      where: { id, userId: request.auth!.userId },
      select: { id: true },
    })
    if (!owned) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Sessão não encontrada' } })
    }
    await revokeSession(id, 'revoked_by_user')
    return reply.code(204).send()
  })
}
