import { cacheService } from '@cache/cache.service.js'
import { REDIS_KEYS, TTL, DEFAULT_APP_URL } from '@config/constants.js'
import { env } from '@config/env.js'
import { randomToken } from '@shared/utils/crypto.util.js'

// =============================================================================
// FinIA — Magic Link Service
// =============================================================================
//
// Login sem senha (decisão aprovada §4): o usuário digita "dashboard" no
// WhatsApp e recebe um link com token de uso único.
//
//   - Token: 32 bytes de entropia (impossível de adivinhar).
//   - Armazenado no Redis: magiclink:{token} → userId, TTL 15 min.
//   - Consumo via GETDEL atômico: o primeiro clique vence; replay falha.
//
// O telefone é o segundo fator implícito: só quem tem o WhatsApp do número
// recebe o link.
//
// =============================================================================

/** Gera um magic link para o usuário e retorna a URL completa. */
export async function createMagicLink(userId: string): Promise<string> {
  const token = randomToken(32)
  // Valor é o userId puro (string) — sem JSON para o takeOnce ser direto
  await cacheService.set(REDIS_KEYS.magicLink(token), userId, TTL.MAGIC_LINK)

  const baseUrl = env.APP_URL ?? DEFAULT_APP_URL
  return `${baseUrl}/auth/magic?token=${token}`
}

/**
 * Consome um magic link (uso único). Retorna o userId ou null se o token for
 * inválido, expirado ou já usado.
 */
export async function consumeMagicLink(token: string): Promise<string | null> {
  if (!token || token.length < 32) return null
  const raw = await cacheService.takeOnce(REDIS_KEYS.magicLink(token))
  if (!raw) return null
  // cacheService.set serializa JSON — "abc" vira "\"abc\""
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed : null
  } catch {
    return null
  }
}
