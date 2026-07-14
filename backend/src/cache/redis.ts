import { Redis, type RedisOptions } from 'ioredis'
import { env, isProduction } from '@config/env.js'
import { logger } from '@config/logger.js'

// =============================================================================
// FinIA — Redis Client Singleton
// =============================================================================
//
// Dois clients exportados:
//
//   redis        → uso geral: cache de aplicação, sessões, rate limit,
//                  idempotência de webhooks, MerchantDB.
//
//   redisQueue   → uso exclusivo do BullMQ.
//                  BullMQ exige uma conexão dedicada porque usa comandos
//                  bloqueantes (BLPOP, BRPOP, XREAD) que travam a conexão
//                  enquanto aguardam mensagens. Compartilhar com o cache
//                  geraria timeouts em todas as outras operações.
//
// Singleton via globalThis: idêntico ao padrão do prisma.ts.
// Em desenvolvimento, tsx watch recarrega módulos sem encerrar o processo —
// sem o padrão, cada reload abriria uma nova conexão ao Redis, esgotando
// o limite de connections do servidor.
//
// =============================================================================

// ─── Opções comuns ───────────────────────────────────────────────────────────
// As mesmas opções base para ambos os clients, com diferenças mínimas
// para BullMQ (documentadas abaixo).
const baseOptions: RedisOptions = {
  // Tempo máximo aguardando o handshake inicial (10s)
  connectTimeout: 10_000,

  // Comandos esperam até esta quantidade de ms antes de falhar.
  // null = espera indefinidamente — adequado para nosso uso, onde
  // perda de conexão deve disparar reconexão em vez de falhar comandos.
  commandTimeout: undefined,

  // ─── Estratégia de reconexão ───────────────────────────────────────────────
  // ioredis chama esta função quando perde a conexão.
  // Retorno: número em ms até a próxima tentativa (ou null/false para desistir).
  //
  // Estratégia: backoff exponencial limitado a 2s.
  //   Tentativa 1 → 50ms
  //   Tentativa 2 → 100ms
  //   Tentativa 3 → 200ms
  //   ...
  //   Tentativa N → max 2000ms
  retryStrategy: (times) => {
    const delay = Math.min(50 * Math.pow(2, times - 1), 2000)
    logger.warn(
      { attempt: times, delayMs: delay },
      'Redis: tentando reconectar'
    )
    return delay
  },

  // Reconecta automaticamente em erros específicos (READONLY = failover Redis)
  // Lista padrão da ioredis já inclui os casos críticos
  reconnectOnError: (err) => {
    const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET']
    return targetErrors.some((target) => err.message.includes(target))
  },

  // ─── Comportamento de inicialização ────────────────────────────────────────
  // false: tenta conectar imediatamente na construção da instância.
  // true:  só conecta quando o primeiro comando for emitido (lazy).
  //
  // Optamos por false: queremos saber no boot se o Redis está acessível,
  // não na primeira operação em produção.
  lazyConnect: false,

  // Habilita o pipeline automático: comandos enviados em sequência
  // são agrupados em um único TCP write. Reduz latência de N comandos
  // de N round-trips para 1 round-trip.
  enableAutoPipelining: true,
}

// ─── Opções específicas para BullMQ ──────────────────────────────────────────
const queueOptions: RedisOptions = {
  ...baseOptions,

  // CRÍTICO: BullMQ exige maxRetriesPerRequest = null
  //
  // Por padrão, ioredis aborta um comando após 20 tentativas se a conexão
  // estiver indisponível. BullMQ usa comandos bloqueantes (BRPOPLPUSH, etc.)
  // que podem ficar aguardando minutos por uma mensagem — se o cliente
  // abortar após 20 tentativas, o worker perde mensagens.
  //
  // null = aguarda indefinidamente. Comandos só falham se a conexão for
  // explicitamente encerrada via redisQueue.disconnect().
  maxRetriesPerRequest: null,

  // BullMQ envia comandos READONLY para slaves em modo cluster.
  // Habilitar enableReadyCheck evita problemas em failover.
  enableReadyCheck: false,
}

// ─── Factory ──────────────────────────────────────────────────────────────────
const createRedisClient = (
  options: RedisOptions = baseOptions,
  name = 'cache'
): Redis => {
  const client = new Redis(env.REDIS_URL, options)

  // ─── Event listeners ─────────────────────────────────────────────────────
  // ioredis emite estes eventos durante o ciclo de vida da conexão.
  // Logamos apenas transições importantes; "ready" e "close" são frequentes
  // em reconexões e gerariam ruído desnecessário em produção.

  client.on('connect', () => {
    logger.info({ client: name }, 'Redis: conexão estabelecida')
  })

  client.on('error', (err) => {
    // ECONNREFUSED durante reconexão é esperado — não logamos como error
    // para evitar spam de logs em ambientes com Redis temporariamente offline
    const isExpectedReconnectError =
      err.message.includes('ECONNREFUSED') ||
      err.message.includes('ETIMEDOUT')

    if (isExpectedReconnectError) {
      logger.warn({ client: name, err: err.message }, 'Redis: erro durante reconexão')
    } else {
      logger.error({ client: name, err }, 'Redis: erro')
    }
  })

  client.on('end', () => {
    logger.info({ client: name }, 'Redis: conexão encerrada')
  })

  // reconnecting é emitido a cada tentativa — silenciamos em produção
  // para reduzir volume de logs; em dev é útil ver o backoff em ação
  if (!isProduction) {
    client.on('reconnecting', (delay: number) => {
      logger.debug({ client: name, delayMs: delay }, 'Redis: reconectando')
    })
  }

  return client
}

// ─── Singleton via globalThis ─────────────────────────────────────────────────
// O ESM cacheia módulos por URL, mas tsx watch recarrega o cache em mudanças.
// globalThis sobrevive ao reload, garantindo uma única instância por processo.
const globalForRedis = globalThis as unknown as {
  redis:      Redis | undefined
  redisQueue: Redis | undefined
}

export const redis: Redis =
  globalForRedis.redis ?? createRedisClient(baseOptions, 'cache')

export const redisQueue: Redis =
  globalForRedis.redisQueue ?? createRedisClient(queueOptions, 'queue')

if (!isProduction) {
  globalForRedis.redis      = redis
  globalForRedis.redisQueue = redisQueue
}

// =============================================================================
// Lifecycle — Verificação e Disconnect
// =============================================================================
//
// Diferente do Prisma, IORedis com lazyConnect:false já tenta conectar na
// construção. As funções abaixo verificam o estado e encerram explicitamente
// no shutdown.
//

/**
 * Verifica a conexão com o Redis.
 * Chamado no boot do servidor e no endpoint GET /health.
 *
 * PING é o comando padrão para verificar liveness do Redis — retorna 'PONG'
 * sem efeito colateral. Falha rápido se o servidor não estiver respondendo.
 */
export async function connectRedis(): Promise<void> {
  try {
    const [cacheReply, queueReply] = await Promise.all([
      redis.ping(),
      redisQueue.ping(),
    ])

    if (cacheReply !== 'PONG' || queueReply !== 'PONG') {
      throw new Error(
        `Resposta inesperada do PING: cache=${cacheReply} queue=${queueReply}`
      )
    }

    logger.info('Redis conectado (cache + queue)')
  } catch (error) {
    logger.error({ err: error }, 'Falha ao conectar ao Redis')
    throw error
  }
}

/**
 * Encerra as conexões com o Redis.
 * Chamado no graceful shutdown (SIGTERM / SIGINT).
 *
 * .quit() envia o comando QUIT ao Redis (graceful) — aguarda comandos
 * pendentes completarem antes de fechar.
 * .disconnect() força o fechamento imediato — usado apenas em casos de erro.
 */
export async function disconnectRedis(): Promise<void> {
  try {
    await Promise.all([
      redis.quit(),
      redisQueue.quit(),
    ])
    logger.info('Redis desconectado (cache + queue)')
  } catch (error) {
    logger.error({ err: error }, 'Erro ao desconectar do Redis')
    // Força o fechamento se .quit() falhou
    redis.disconnect()
    redisQueue.disconnect()
  }
}

// =============================================================================
// Tipos auxiliares
// =============================================================================

// Tipo do Redis client — útil para funções que recebem o client como parâmetro
// (testes de integração, serviços de cache, etc.)
export type RedisClient = Redis
