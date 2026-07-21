import { cacheService } from '@cache/cache.service.js'
import { randomToken } from '@shared/utils/crypto.util.js'

// =============================================================================
// FinIA — Vínculo Telegram ↔ conta
// =============================================================================
//
// Fluxo: o usuário logado gera um código curto (Redis, 15 min). Ele abre o bot
// com /start <código>; o webhook consome o código → userId e grava o chatId.
//
// =============================================================================

const key = (code: string): string => `tglink:${code}`
const TTL_SECONDS = 60 * 15

/** Gera um código de vínculo para o usuário. */
export async function createTelegramLinkCode(userId: string): Promise<string> {
  const code = randomToken(12)
  await cacheService.set(key(code), userId, TTL_SECONDS)
  return code
}

/** Consome o código (uso único) e retorna o userId, ou null se inválido. */
export async function consumeTelegramLinkCode(code: string): Promise<string | null> {
  const raw = await cacheService.takeOnce(key(code))
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed : null
  } catch {
    return null
  }
}
