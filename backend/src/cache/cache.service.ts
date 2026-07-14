import { redis } from './redis.js'
import { logger } from '@config/logger.js'

// =============================================================================
// FinIA — Cache Service
// =============================================================================
//
// Camada tipada sobre o client `redis` (cache geral, NÃO o redisQueue).
// Serializa/desserializa JSON automaticamente e expõe utilitários comuns:
// get<T>, set com TTL, del, getOrSet e markIfFirst (idempotência).
//
// =============================================================================

export class CacheService {
  /**
   * Lê e desserializa um valor. Retorna null se a chave não existe ou se o
   * conteúdo estiver corrompido (não-JSON) — neste caso loga um aviso.
   */
  async get<T>(key: string): Promise<T | null> {
    const raw = await redis.get(key)
    if (raw === null) return null

    try {
      return JSON.parse(raw) as T
    } catch {
      logger.warn({ key }, 'Cache: valor não-JSON ignorado')
      return null
    }
  }

  /**
   * Grava um valor serializado. Se ttlSeconds for informado, a chave expira;
   * caso contrário, persiste até ser sobrescrita/removida.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value)
    if (ttlSeconds && ttlSeconds > 0) {
      await redis.set(key, payload, 'EX', ttlSeconds)
    } else {
      await redis.set(key, payload)
    }
  }

  /** Remove uma chave (no-op se não existir). */
  async del(key: string): Promise<void> {
    await redis.del(key)
  }

  /** true se a chave existe. */
  async exists(key: string): Promise<boolean> {
    return (await redis.exists(key)) === 1
  }

  /**
   * Retorna o valor cacheado ou, na ausência, executa `factory`, cacheia o
   * resultado e o retorna. Padrão "cache-aside".
   */
  async getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) return cached

    const fresh = await factory()
    await this.set(key, fresh, ttlSeconds)
    return fresh
  }

  /**
   * Lê E REMOVE uma chave atomicamente (GETDEL). Base de tokens de uso único
   * (magic links): dois consumos simultâneos do mesmo token — só um vence.
   * Retorna null se a chave não existe (ou expirou).
   */
  async takeOnce(key: string): Promise<string | null> {
    return redis.getdel(key)
  }

  /**
   * Marca uma chave de forma atômica APENAS se ainda não existir (SET NX).
   * Retorna true se esta foi a primeira vez (chave criada agora), false se já
   * existia. Base da idempotência de webhooks: a primeira chamada processa,
   * as duplicatas (mesmo messageId) recebem false e são descartadas.
   */
  async markIfFirst(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX')
    return result === 'OK'
  }
}

// Instância singleton — stateless, seguro compartilhar.
export const cacheService = new CacheService()
