import type { QueueOptions, WorkerOptions } from 'bullmq'
import { redisQueue } from '@cache/redis.js'

// =============================================================================
// FinIA — Configuração base do BullMQ
// =============================================================================
//
// Conexão: usamos o client DEDICADO redisQueue (maxRetriesPerRequest: null),
// nunca o client de cache. Compartilhar quebraria o cache com os comandos
// bloqueantes do BullMQ (decisão aprovada / anti-padrão #2).
//
// Política de jobs padrão:
//   - attempts 3 + backoff exponencial: tolera falhas transitórias (API do
//     WhatsApp instável, blip de rede) sem perder o job.
//   - removeOnComplete: mantém os últimos 100 (e até 24h) para inspeção no
//     Bull Board, sem encher o Redis indefinidamente.
//   - removeOnFail: mantém os últimos 500 para diagnóstico de erros.
//
// =============================================================================

export const defaultQueueOptions: QueueOptions = {
  connection: redisQueue,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s entre tentativas
    },
    removeOnComplete: {
      count: 100,
      age: 60 * 60 * 24, // 24h
    },
    removeOnFail: {
      count: 500,
    },
  },
}

// Opções base dos workers. Cada worker pode sobrescrever a concorrência.
export const defaultWorkerOptions: WorkerOptions = {
  connection: redisQueue,
  // Processa até 5 jobs simultâneos por worker. Suficiente para o volume
  // esperado e seguro para a pool de conexões do Postgres.
  concurrency: 5,
}
