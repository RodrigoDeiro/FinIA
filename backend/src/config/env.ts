import { z } from 'zod'

// =============================================================================
// FinIA — Validação de Variáveis de Ambiente
// =============================================================================
//
// PRINCÍPIO: este arquivo valida apenas variáveis globais do processo.
// Variáveis específicas de módulo são validadas quando o módulo é inicializado:
//
//   EVOLUTION_* → src/modules/whatsapp/whatsapp.module.ts
//   ANTHROPIC_*  → src/modules/ai/ai.module.ts        (Sprint 2)
//   JWT_*        → src/modules/auth/auth.module.ts     (Sprint 3)
//
// Isso permite que o servidor suba e responda /health mesmo sem credenciais
// de módulos ainda não configurados — essencial para desenvolvimento incremental.
//
// Dev fora do Docker:
//   node --env-file=.env node_modules/.bin/tsx watch src/server.ts
//   Ou: export $(grep -v '^#' .env | xargs) && npm run dev
//   No Docker: docker-compose provê as variáveis via env_file + environment.
//
// =============================================================================

// ─── Helper: Boolean a partir de string ──────────────────────────────────────
// z.coerce.boolean() usa Boolean() internamente:
//   Boolean('false') === true  ← bug! string não-vazia é sempre truthy
// Este helper converte 'true'/'false' corretamente.
const boolFromString = z
  .string()
  .optional()
  .default('false')
  .transform((val) => val.toLowerCase() === 'true')

// =============================================================================
// Schema — apenas variáveis globais obrigatórias
// =============================================================================
const envSchema = z.object({

  // ─── Aplicação ─────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.coerce
    .number()
    .int()
    .min(1024, 'PORT deve ser >= 1024')
    .max(65535, 'PORT deve ser <= 65535')
    .default(3000),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // ─── PostgreSQL ────────────────────────────────────────────────────────────
  // DATABASE_URL é o que o app REALMENTE usa (Prisma). POSTGRES_USER/PASSWORD/DB
  // são OPCIONAIS: servem apenas para o docker-compose LOCAL inicializar o
  // container do Postgres. Na nuvem (ex: Supabase) basta a DATABASE_URL.
  POSTGRES_USER:     z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DB:       z.string().optional(),
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL deve ser uma URL válida — ex: postgresql://user:pass@host:5432/db'),

  // ─── Redis ─────────────────────────────────────────────────────────────────
  // O app usa REDIS_URL (a senha vai embutida nela). REDIS_PASSWORD é OPCIONAL:
  // só o docker-compose local precisa (para o requirepass). Na nuvem (ex:
  // Upstash) a senha já está na REDIS_URL (rediss://default:senha@host:port).
  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL:      z.string().min(1, 'REDIS_URL é obrigatório'),
  // min(1) em vez de .url(): Redis URLs com usuário vazio (redis://:pass@host)
  // não passam consistentemente no parser WHATWG em todas as versões do Node.js

  // ─── WhatsApp — Evolution API ───────────────────────────────────────────────
  // OPCIONAL aqui. Validação real ocorre em whatsapp.module.ts ao inicializar.
  // Isso permite subir o servidor e testar /health sem credenciais WhatsApp.
  EVOLUTION_API_URL:       z.string().url().optional(),
  EVOLUTION_API_KEY:       z.string().min(1).optional(),
  EVOLUTION_INSTANCE_NAME: z.string().min(1).optional(),
  EVOLUTION_WEBHOOK_SECRET: z
    .string()
    .min(16, 'EVOLUTION_WEBHOOK_SECRET deve ter no mínimo 16 caracteres')
    .optional(),
  WHATSAPP_PROVIDER: z
    .enum(['evolution', 'meta'])
    .default('evolution'),

  // ─── Telegram Bot (opcional) ────────────────────────────────────────────────
  // Se TELEGRAM_BOT_TOKEN estiver presente, o módulo Telegram é ativado (webhook
  // + envio). Sem ele, o app sobe normalmente sem Telegram.
  TELEGRAM_BOT_TOKEN:      z.string().min(1).optional(),
  TELEGRAM_BOT_USERNAME:   z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),

  // ─── IA — Anthropic Claude (Sprint 2+) ────────────────────────────────────
  // OPCIONAL aqui. Validação real ocorre em ai.module.ts ao inicializar.
  ANTHROPIC_API_KEY: z
    .string()
    .refine(
      (val) => val.startsWith('sk-ant-'),
      'ANTHROPIC_API_KEY deve começar com sk-ant-'
    )
    .optional(),

  // ─── JWT — Autenticação (Sprint 3+) ────────────────────────────────────────
  // OPCIONAL aqui. Validação real ocorre em auth.module.ts ao inicializar.
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET deve ter no mínimo 32 caracteres — gere com: openssl rand -hex 64')
    .optional(),
  JWT_EXPIRES_IN:         z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // ─── URLs ──────────────────────────────────────────────────────────────────
  APP_URL: z.string().url().optional(),

  // ─── Storage (Sprint 4+) ───────────────────────────────────────────────────
  STORAGE_PATH: z.string().default('./storage/reports'),

  // ─── Frontend (produção) ────────────────────────────────────────────────────
  // Caminho do build do dashboard (frontend/dist). Se definido, o backend serve
  // o SPA na raiz e a API em /api — mesma origem, cookies funcionam sem CORS.
  // Em dev fica vazio: o Vite serve o front e faz proxy da API.
  FRONTEND_DIST: z.string().optional(),

  // ─── Ferramentas de desenvolvimento ────────────────────────────────────────
  PGADMIN_DEFAULT_EMAIL:    z.string().email().optional(),
  PGADMIN_DEFAULT_PASSWORD: z.string().optional(),
  REDIS_COMMANDER_USER:     z.string().optional(),
  REDIS_COMMANDER_PASSWORD: z.string().optional(),

  // ─── Hot Reload ────────────────────────────────────────────────────────────
  CHOKIDAR_USEPOLLING: boolFromString,
})

// =============================================================================
// Tipo exportado
// =============================================================================
export type Env = z.infer<typeof envSchema>

// =============================================================================
// Validação de módulos — chamada por cada módulo ao inicializar
// =============================================================================
//
// Uso em whatsapp.module.ts:
//   import { assertWhatsAppEnv } from '@config/env.js'
//   assertWhatsAppEnv() // lança se variáveis ausentes
//

export function assertWhatsAppEnv(e: Env): asserts e is Env & {
  EVOLUTION_API_URL:       string
  EVOLUTION_API_KEY:       string
  EVOLUTION_INSTANCE_NAME: string
  EVOLUTION_WEBHOOK_SECRET: string
} {
  const missing: string[] = []
  if (!e.EVOLUTION_API_URL)       missing.push('EVOLUTION_API_URL')
  if (!e.EVOLUTION_API_KEY)       missing.push('EVOLUTION_API_KEY')
  if (!e.EVOLUTION_INSTANCE_NAME) missing.push('EVOLUTION_INSTANCE_NAME')
  if (!e.EVOLUTION_WEBHOOK_SECRET) missing.push('EVOLUTION_WEBHOOK_SECRET')

  if (missing.length > 0) {
    throw new Error(
      `Módulo WhatsApp: variáveis de ambiente ausentes:\n` +
      missing.map((v) => `  ✗ ${v}`).join('\n') +
      `\n\nVerifique o .env (cp .env.example .env)`
    )
  }
}

export function assertAiEnv(e: Env): asserts e is Env & {
  ANTHROPIC_API_KEY: string
} {
  if (!e.ANTHROPIC_API_KEY) {
    throw new Error(
      'Módulo AI: ANTHROPIC_API_KEY ausente.\n' +
      'Obtenha sua chave em: https://console.anthropic.com'
    )
  }
}

export function assertAuthEnv(e: Env): asserts e is Env & {
  JWT_SECRET: string
} {
  if (!e.JWT_SECRET) {
    throw new Error(
      'Módulo Auth: JWT_SECRET ausente.\n' +
      'Gere com: openssl rand -hex 64'
    )
  }
}

// =============================================================================
// Inicialização — fast fail para variáveis globais
// =============================================================================
function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (result.success) {
    return result.data
  }

  const { fieldErrors } = result.error.flatten()
  const errorLines = Object.entries(fieldErrors)
    .map(([field, errors]) => `  ✗  ${field}: ${errors?.join(', ') ?? 'valor inválido'}`)
    .join('\n')

  console.error(`
╔══════════════════════════════════════════════════════════════╗
║       Variáveis de ambiente inválidas ou ausentes            ║
╠══════════════════════════════════════════════════════════════╣

${errorLines}

╠══════════════════════════════════════════════════════════════╣
║  Verifique o arquivo .env:                                   ║
║    cp .env.example .env                                      ║
║                                                              ║
║  Secrets ausentes? Gere com:                                 ║
║    openssl rand -hex 32   (webhook, JWT curto)               ║
║    openssl rand -hex 64   (JWT principal)                    ║
╚══════════════════════════════════════════════════════════════╝
`)

  process.exit(1)
}

// Singleton: validação executa uma vez na primeira importação do módulo.
// Todos os demais imports recebem o mesmo objeto cacheado pelo ESM.
export const env = validateEnv()

// ─── Helpers de ambiente ──────────────────────────────────────────────────────
export const isDevelopment = env.NODE_ENV === 'development'
export const isProduction  = env.NODE_ENV === 'production'
export const isTest        = env.NODE_ENV === 'test'
