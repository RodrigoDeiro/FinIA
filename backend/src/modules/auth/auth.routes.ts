import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@database/prisma.js'
import { env } from '@config/env.js'
import { AUTH_COOKIES } from '@config/constants.js'
import { parseDurationMs } from '@shared/utils/duration.util.js'
import { consumeMagicLink } from './magic-link.service.js'
import { hashPassword, verifyPassword } from '@shared/utils/password.util.js'
import { createWebUser } from '@modules/user/user.repository.js'
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
const loginBodySchema = z.object({ email: z.string().email(), password: z.string().min(1) })
const setPasswordBodySchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres'),
})
const registerBodySchema = z.object({
  name: z.string().trim().min(1, 'Informe seu nome').max(120),
  email: z.string().email(),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres'),
})

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

  // ─── POST /register — cadastro web (nome + email + senha) ──────────────────
  app.post('/register', async (request, reply) => {
    const parsed = registerBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      })
    }

    const email = parsed.data.email.toLowerCase().trim()
    let user
    try {
      user = await createWebUser({
        name: parsed.data.name.trim(),
        email,
        passwordHash: hashPassword(parsed.data.password),
      })
    } catch {
      // Violação de unique (email já cadastrado)
      return reply.code(409).send({ error: { code: 'EMAIL_TAKEN', message: 'Esse email já está cadastrado' } })
    }

    const { session, refreshToken } = await createSession(user.id, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })
    setAuthCookies(reply, signAccessToken(session.id, user.id), refreshToken)
    return reply.code(201).send({
      user: { id: user.id, name: user.name, phoneNumber: user.phoneNumber, currency: user.currency, timezone: user.timezone },
    })
  })

  // ─── POST /login — login por email + senha ─────────────────────────────────
  app.post('/login', async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body)
    // Falha genérica: não revela se o problema é email ou senha (info p/ atacante)
    const fail = () =>
      reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Email ou senha inválidos' } })
    if (!parsed.success) return fail()

    const email = parsed.data.email.toLowerCase().trim()
    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } })
    if (!user?.passwordHash || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return fail()
    }

    const { session, refreshToken } = await createSession(user.id, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })
    setAuthCookies(reply, signAccessToken(session.id, user.id), refreshToken)
    return reply.code(200).send({
      user: { id: user.id, name: user.name, phoneNumber: user.phoneNumber, currency: user.currency, timezone: user.timezone },
    })
  })

  // ─── POST /set-password — define/atualiza a senha (e opcionalmente o email) ──
  app.post('/set-password', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = setPasswordBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      })
    }

    const data: { passwordHash: string; email?: string } = {
      passwordHash: hashPassword(parsed.data.password),
    }
    if (parsed.data.email) data.email = parsed.data.email.toLowerCase().trim()

    try {
      await prisma.user.update({ where: { id: request.auth!.userId }, data })
    } catch {
      // Violação de unique no email
      return reply.code(409).send({ error: { code: 'EMAIL_TAKEN', message: 'Esse email já está em uso' } })
    }
    return reply.code(204).send()
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
