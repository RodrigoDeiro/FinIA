// =============================================================================
// FinIA — Constantes Globais
// =============================================================================
//
// Valores fixos compartilhados entre módulos. Centralizar aqui evita "magic
// strings" espalhadas pelo código e mantém os nomes de filas, prefixos de
// chaves Redis e thresholds do parser em um único lugar auditável.
//
// =============================================================================

// ─── Filas BullMQ ─────────────────────────────────────────────────────────────
// Os nomes são a identidade da fila no Redis. Mudar um nome aqui "abandona"
// os jobs já enfileirados sob o nome antigo — tratar como contrato estável.
export const QUEUE_NAMES = {
  MESSAGE_INCOMING:     'message.incoming',
  NOTIFICATION_OUTBOUND: 'notification.outbound',
  INSIGHT_GENERATOR:    'insight.generator',
  REPORT_GENERATOR:     'report.generator',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

// ─── Prefixos de chaves Redis ─────────────────────────────────────────────────
// Convenção: <dominio>:<subdominio>:<id>. Prefixos facilitam inspeção no
// Redis Commander e permitem invalidação por padrão (SCAN MATCH prefixo:*).
export const REDIS_KEYS = {
  // Idempotência de webhooks: marca um providerMessageId como já processado
  idempotency: (provider: string, messageId: string): string =>
    `idempotency:${provider}:${messageId}`,

  // Cache do MerchantDB global (lista carregada do Postgres)
  merchantDbGlobal: 'merchantdb:global',

  // Cache de merchants aprendidos por usuário
  merchantDbUser: (userId: string): string => `merchantdb:user:${userId}`,

  // Cache de resumo do usuário (saldo, transações recentes) — invalidado em writes
  userCache: (userId: string): string => `user:${userId}:summary`,

  // Camada 1 da memória de IA: contexto curto da conversa (Sprint 2)
  conversation: (userId: string): string => `conversation:${userId}`,

  // Magic link de acesso ao dashboard (Sprint 3): token → userId, uso único
  magicLink: (token: string): string => `magiclink:${token}`,
} as const

// ─── TTLs (segundos) ──────────────────────────────────────────────────────────
export const TTL = {
  // Idempotência: 24h. Cobre retries do Evolution e mensagens reenviadas.
  IDEMPOTENCY:   60 * 60 * 24,
  // MerchantDB: 1h. Recarregado do Postgres ao expirar ou em correção do usuário.
  MERCHANT_DB:   60 * 60,
  // Resumo do usuário: 5min. Equilíbrio entre frescor e carga no banco.
  USER_CACHE:    60 * 5,
  // Conversa (memória curta da IA): 24h.
  CONVERSATION:  60 * 60 * 24,
  // Magic link: 15min, uso único (decisão aprovada — §10 Sprint 3).
  MAGIC_LINK:    60 * 15,
} as const

// ─── Autenticação web (Sprint 3) ──────────────────────────────────────────────
export const AUTH_COOKIES = {
  /** Cookie do access token (JWT) — enviado em toda a API */
  ACCESS: 'finia_access',
  /** Cookie do refresh token — enviado APENAS nas rotas de auth (path restrito) */
  REFRESH: 'finia_refresh',
  /** Path do cookie de refresh: limita a exposição do token de longa duração */
  REFRESH_PATH: '/api/v1/auth',
} as const

/** URL do frontend usada no magic link quando APP_URL não está no .env. */
export const DEFAULT_APP_URL = 'http://localhost:5173'

// ─── Thresholds do parser determinístico ──────────────────────────────────────
// Score de confiança 0.00–1.00. Decide o destino da mensagem:
//   >= AUTO_SAVE          → salva a transação direto
//   [REVIEW, AUTO_SAVE)   → salva com needsReview = true
//   <  REVIEW             → encaminha para a IA (Sprint 2)
export const CONFIDENCE = {
  AUTO_SAVE: 0.85,
  REVIEW:    0.65,
} as const

// ─── Onboarding ───────────────────────────────────────────────────────────────
// Conta "Principal" criada automaticamente na primeira mensagem do usuário.
export const DEFAULT_ACCOUNT_NAME = 'Principal'

// Slug da categoria usada quando o parser não identifica uma categoria melhor.
export const FALLBACK_CATEGORY_SLUG = 'outros'

// ─── Timezone / moeda padrão ──────────────────────────────────────────────────
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo'
export const DEFAULT_CURRENCY = 'BRL'
export const DEFAULT_LANGUAGE = 'pt'

// ─── IA — Claude (Sprint 2) ───────────────────────────────────────────────────
// Estratégia de custo aprovada (ARCHITECTURE §4): modelo rápido/barato para
// parsing e queries, modelo mais capaz para insights/relatórios. IDs atuais
// (os do ARCHITECTURE.md — claude-3-haiku / claude-sonnet-4 — estavam defasados).
export const AI_MODELS = {
  /** Parsing de mensagens ambíguas e respostas de consulta */
  PARSER: 'claude-haiku-4-5',
  /** Insights e relatórios narrativos (Sprint 4) */
  INSIGHTS: 'claude-sonnet-4-6',
} as const

// Se a própria IA reporta confiança abaixo disto, tratamos a mensagem como
// "não é uma transação" (em vez de salvar algo provavelmente errado).
export const AI_MIN_CONFIDENCE = 0.4
