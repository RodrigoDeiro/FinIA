// =============================================================================
// FinIA — Utilitário de Duração
// =============================================================================
//
// Converte durações legíveis do .env ("1h", "30d", "15m") em milissegundos.
// Usado pela autenticação (JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN) — o
// fast-jwt (por trás do @fastify/jwt) espera expiresIn em ms.
//
// =============================================================================

const DURATION_RE = /^(\d+)\s*(ms|s|m|h|d)$/i

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

/**
 * "1h" → 3600000. Lança em formato inválido — durações vêm do .env e um valor
 * quebrado deve falhar alto no boot, não silenciosamente virar sessão infinita.
 */
export function parseDurationMs(input: string): number {
  const match = input.trim().match(DURATION_RE)
  if (!match) {
    throw new Error(`Duração inválida: "${input}" (esperado ex: 45s, 15m, 1h, 30d)`)
  }
  return Number(match[1]) * UNIT_MS[match[2].toLowerCase()]
}
