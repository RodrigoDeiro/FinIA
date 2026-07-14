import bcrypt from 'bcryptjs'
import type { Session } from '@prisma/client'
import { prisma } from '@database/prisma.js'
import { env } from '@config/env.js'
import { logger } from '@config/logger.js'
import { randomToken } from '@shared/utils/crypto.util.js'
import { parseDurationMs } from '@shared/utils/duration.util.js'

// =============================================================================
// FinIA — Session Service (refresh tokens com rotação)
// =============================================================================
//
// Decisões aprovadas (§4):
//   - Sessions na tabela `sessions`: hash BCRYPT do refresh token (nunca plain),
//     metadata (IP, user-agent), revogação granular.
//   - ROTAÇÃO: cada refresh troca o segredo. Um refresh token antigo reutilizado
//     não bate com o hash atual ⇒ roubo/replay detectado ⇒ sessão inteira
//     revogada (o ladrão E o dono perdem — o dono refaz login pelo WhatsApp).
//
// Formato do refresh token entregue ao cliente: "{sessionId}.{segredo}".
// O sessionId localiza a linha; o segredo (32 bytes) é comparado com bcrypt.
// (bcrypt não permite busca por hash — por isso o id viaja junto.)
//
// Usa o client base do Prisma: o login acontece ANTES de existir contexto de
// tenant. A posse do refresh token é a autorização aqui.
//
// =============================================================================

const BCRYPT_ROUNDS = 10

export interface SessionMeta {
  userAgent?: string | null
  ipAddress?: string | null
}

export interface IssuedSession {
  session: Session
  /** Entregue ao cliente via cookie httpOnly — nunca logar */
  refreshToken: string
}

function refreshTtlMs(): number {
  return parseDurationMs(env.JWT_REFRESH_EXPIRES_IN)
}

/** Cria uma sessão nova (login via magic link). */
export async function createSession(userId: string, meta: SessionMeta): Promise<IssuedSession> {
  const secret = randomToken(32)
  const refreshTokenHash = await bcrypt.hash(secret, BCRYPT_ROUNDS)

  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
      expiresAt: new Date(Date.now() + refreshTtlMs()),
    },
  })

  logger.info({ userId, sessionId: session.id }, 'Sessão web criada (magic link)')
  return { session, refreshToken: `${session.id}.${secret}` }
}

/**
 * Valida um refresh token e ROTACIONA o segredo.
 * Retorna a sessão + novo token, ou null (expirado/revogado/inválido).
 * Reuso de token antigo em sessão válida ⇒ revoga a sessão (roubo detectado).
 */
export async function verifyAndRotate(refreshToken: string): Promise<IssuedSession | null> {
  const dot = refreshToken.indexOf('.')
  if (dot <= 0) return null
  const sessionId = refreshToken.slice(0, dot)
  const secret = refreshToken.slice(dot + 1)
  if (!sessionId || secret.length < 32) return null

  const session = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null

  const matches = await bcrypt.compare(secret, session.refreshTokenHash)
  if (!matches) {
    // Segredo antigo em sessão viva = replay pós-rotação ⇒ revogação defensiva
    await revokeSession(sessionId, 'refresh_token_reuse')
    logger.warn(
      { sessionId, userId: session.userId },
      'SEGURANÇA: reuso de refresh token detectado — sessão revogada',
    )
    return null
  }

  // Rotação: novo segredo, mesmo registro de sessão
  const newSecret = randomToken(32)
  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      refreshTokenHash: await bcrypt.hash(newSecret, BCRYPT_ROUNDS),
      lastActiveAt: new Date(),
    },
  })

  return { session: updated, refreshToken: `${sessionId}.${newSecret}` }
}

/** Sessão viva (não revogada, não expirada) — usada pelo guard a cada request. */
export async function getLiveSession(sessionId: string): Promise<Session | null> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null
  return session
}

export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  })
}

/** Sessões ativas do usuário (tela "sessões ativas" do dashboard). */
export async function listActiveSessions(userId: string): Promise<Session[]> {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: 'desc' },
  })
}
