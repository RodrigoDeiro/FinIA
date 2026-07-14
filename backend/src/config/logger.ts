import pino from 'pino'
import { env, isDevelopment } from '@config/env.js'

// =============================================================================
// FinIA — Logger (Pino)
// =============================================================================
//
// Dois modos de operação:
//
//   development → pino-pretty: saída colorida e legível no terminal
//   production  → JSON puro: uma linha por evento, pronto para ingestão
//                 por Datadog, CloudWatch, Loki, etc.
//
// Dois exports:
//
//   loggerOptions → passado ao Fastify ({ logger: loggerOptions })
//                   Fastify cria sua própria instância e adiciona request.log
//
//   logger        → instância standalone para uso fora do Fastify:
//                   workers BullMQ, queue processors, scripts de seed, etc.
//
// =============================================================================

// ─── Transport ───────────────────────────────────────────────────────────────
// Em produção: undefined → pino escreve JSON direto para stdout (fd 1)
// Em desenvolvimento: pino-pretty formata e colore antes de escrever
//
// pino-pretty roda em um worker_thread separado (não bloqueia o event loop)
const transport: pino.TransportSingleOptions | undefined = isDevelopment
  ? {
      target: 'pino-pretty',
      options: {
        colorize:      true,
        translateTime: 'SYS:HH:MM:ss.l',   // hora local — HH:MM:ss.ms
        ignore:        'pid,hostname',       // remove ruído em dev
        singleLine:    false,
        messageFormat: '{msg}',
      },
    }
  : undefined

// ─── Campos a redatar ────────────────────────────────────────────────────────
// Pino usa fast-redact com comportamento de wildcard específico:
//
//   'password'    → redata { password: 'x' }           (root-level)
//   '*.password'  → redata { user: { password: 'x' } } (um nível de profundidade)
//   '*.*.password'→ redata { a: { b: { password } } }  (dois níveis)
//
// Importante: '*.password' NÃO redata root-level { password: 'x' }.
// Por isso listamos ambas as formas para cada campo sensível.
//
// Redação ocorre antes de qualquer serialização — segredos nunca chegam ao stdout.
const REDACTED_PATHS = [
  // Headers HTTP — sempre nested sob req.headers
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',

  // Campos sensíveis na raiz do objeto logado
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'webhookSecret',
  'webhook_secret',
  'accessToken',
  'refreshToken',

  // Mesmos campos um nível abaixo (ex: { user: { password } }, { config: { secret } })
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.api_key',
  '*.privateKey',
  '*.webhookSecret',
  '*.accessToken',
  '*.refreshToken',
]

// ─── Opções do logger ─────────────────────────────────────────────────────────
export const loggerOptions: pino.LoggerOptions = {
  // Nível vem do env — debug em dev, info em prod
  level: env.LOG_LEVEL,

  // Timestamp:
  //   dev  → epoch cru; o pino-pretty traduz para hora local via translateTime
  //          ('SYS:HH:MM:ss.l' acima). Pino não expõe um stdTimeFunction de hora local.
  //   prod → ISO 8601 UTC para log aggregators
  timestamp: isDevelopment
    ? pino.stdTimeFunctions.epochTime
    : pino.stdTimeFunctions.isoTime,

  // Base:
  //   dev  → undefined remove pid e hostname (ruído em localhost)
  //   prod → mantém pid para correlação em ambientes com múltiplos processos
  base: isDevelopment
    ? undefined
    : { pid: process.pid },

  // Redação aplicada antes de qualquer serialização
  redact: {
    paths:  REDACTED_PATHS,
    censor: '[REDACTED]',
  },

  // Serializers customizados para o ciclo request/response do Fastify.
  // Fastify passa req e res para esses serializers ao logar cada request.
  serializers: {
    req: pino.stdSerializers.wrapRequestSerializer((req) => ({
      id:     req.id,
      method: req.method,
      url:    req.url,
      // user-agent útil para debug, omitido em produção para reduzir volume
      ...(isDevelopment && {
        userAgent: req.headers['user-agent'],
      }),
    })),
    res: pino.stdSerializers.wrapResponseSerializer((res) => ({
      statusCode: res.statusCode,
    })),
    // Serializa Error corretamente — inclui type, message, stack e cause
    err: pino.stdSerializers.err,
  },

  transport,
}

// ─── Instância standalone ─────────────────────────────────────────────────────
// Usada fora do contexto Fastify: workers, queue processors, seed, scripts.
//
// Para contextos específicos, crie um child logger:
//   const workerLog = logger.child({ worker: 'message.processor' })
//   workerLog.info({ jobId }, 'Processando mensagem')
//
// Não usar request.log fora de handlers HTTP — use este logger diretamente.
export const logger = pino(loggerOptions)

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────
export type Logger      = pino.Logger
export type ChildLogger = pino.Logger
