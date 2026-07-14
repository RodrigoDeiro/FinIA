import type { FastifyReply } from 'fastify'
import { env, isProduction } from '@config/env.js'
import { AUTH_COOKIES } from '@config/constants.js'
import { parseDurationMs } from '@shared/utils/duration.util.js'

// =============================================================================
// FinIA — Cookies de autenticação
// =============================================================================
//
// Decisão aprovada (§4): JWT em cookie httpOnly + Secure + SameSite=Lax —
// NUNCA em localStorage (anti-padrão #10). Secure só em produção (dev roda
// em http://localhost).
//
// O cookie de refresh tem path restrito a /api/v1/auth: o token de longa
// duração só trafega nas rotas de auth, nunca no resto da API.
//
// =============================================================================

const base = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction,
}

export function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string): void {
  reply.setCookie(AUTH_COOKIES.ACCESS, accessToken, {
    ...base,
    path: '/',
    maxAge: Math.floor(parseDurationMs(env.JWT_EXPIRES_IN) / 1000),
  })
  reply.setCookie(AUTH_COOKIES.REFRESH, refreshToken, {
    ...base,
    path: AUTH_COOKIES.REFRESH_PATH,
    maxAge: Math.floor(parseDurationMs(env.JWT_REFRESH_EXPIRES_IN) / 1000),
  })
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(AUTH_COOKIES.ACCESS, { path: '/' })
  reply.clearCookie(AUTH_COOKIES.REFRESH, { path: AUTH_COOKIES.REFRESH_PATH })
}
