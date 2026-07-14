import { PrismaClient, type Prisma } from '@prisma/client'
import { isDevelopment, isProduction, isTest } from '@config/env.js'
import { logger } from '@config/logger.js'

// =============================================================================
// FinIA — Prisma Client Singleton
// =============================================================================
//
// Por que singleton com globalThis:
//
//   Em desenvolvimento, tsx watch recarrega módulos a cada alteração de arquivo.
//   Sem o padrão de singleton, cada reload cria um novo PrismaClient, abre uma
//   nova conexão e a anterior fica pendurada — PostgreSQL tem limite de conexões
//   (max_connections, padrão 100). Depois de ~50 reloads, o banco rejeita novas
//   conexões com "too many clients already".
//
//   Solução: armazenar a instância em globalThis, que sobrevive ao reload de
//   módulos ESM no mesmo processo. Em produção, o padrão não tem efeito —
//   cada processo Docker tem exatamente um PrismaClient.
//
// Extensões planejadas (não implementadas neste Sprint):
//
//   Sprint 3 — Tenant Isolation (via $extends + AsyncLocalStorage):
//     Cada query recebe automaticamente WHERE userId = :currentUser.
//     O userId é injetado via AsyncLocalStorage a partir do middleware de auth.
//     Elimina a necessidade de passar userId manualmente em cada service.
//
//   Sprint 3 — Soft Delete (via $extends):
//     Queries filtram automaticamente WHERE deletedAt IS NULL.
//     Hard deletes substituídos por updates: deletedAt = NOW().
//
// =============================================================================

// ─── Configuração de log ──────────────────────────────────────────────────────
// Usando string literals (não objetos com emit:'event') o Prisma envia
// os logs diretamente para stdout — sem necessidade de $on listeners.
//
// development → inclui queries (útil para debug de N+1 e queries lentas)
// test        → silencioso (não polui o output dos testes)
// production  → apenas warn e error (reduz volume de logs)
const getPrismaLogLevels = (): Prisma.LogLevel[] => {
  if (isTest)        return []
  if (isDevelopment) return ['query', 'warn', 'error']
  return              ['warn', 'error']
}

// ─── Factory ──────────────────────────────────────────────────────────────────
const createPrismaClient = () => {
  const client = new PrismaClient({
    log: getPrismaLogLevels(),

    // pretty: mensagens de erro formatadas com cores e contexto (dev/test)
    // minimal: apenas a mensagem, sem stack trace do Prisma (prod — menos ruído)
    errorFormat: isProduction ? 'minimal' : 'pretty',
  })

  return client
}

// ─── Singleton via globalThis ─────────────────────────────────────────────────
// TypeScript não conhece propriedades arbitrárias em globalThis por padrão.
// O cast explícito é o padrão recomendado pelo Prisma para este caso.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient()

// Armazena no globalThis apenas fora de produção.
// Em produção, o módulo é importado uma única vez — sem necessidade.
if (!isProduction) {
  globalForPrisma.prisma = prisma
}

// =============================================================================
// Lifecycle — Connect e Disconnect
// =============================================================================
//
// Prisma conecta lazily (na primeira query).
// connectDatabase() é chamado no boot do servidor para:
//   1. Verificar a conexão antes de aceitar tráfego
//   2. Falhar rápido se o banco estiver inacessível
//
// disconnectDatabase() é chamado no graceful shutdown.
//

/**
 * Verifica a conexão com o banco de dados.
 * Chamado no boot do servidor e no endpoint GET /health.
 *
 * Usa $queryRaw em vez de $connect() porque $connect() não garante
 * que o banco está respondendo — apenas que a conexão foi aberta.
 * Uma query real confirma que o PostgreSQL está aceitando comandos.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`
    logger.info('Banco de dados conectado')
  } catch (error) {
    logger.error({ err: error }, 'Falha ao conectar ao banco de dados')
    throw error
  }
}

/**
 * Encerra a conexão com o banco de dados.
 * Chamado no graceful shutdown (SIGTERM / SIGINT).
 *
 * Aguarda queries em andamento completarem antes de desconectar.
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect()
    logger.info('Banco de dados desconectado')
  } catch (error) {
    logger.error({ err: error }, 'Erro ao desconectar do banco de dados')
    // Não relança — estamos encerrando o processo de qualquer forma
  }
}

// =============================================================================
// Tipos auxiliares
// =============================================================================

// Tipo do Prisma Client — útil para funções que recebem o client como parâmetro
// (testes de integração, repositórios, etc.)
export type PrismaDB = typeof prisma

// Tipo de transação interativa — para funções executadas dentro de $transaction
// Uso: async function createUserWithAccount(tx: PrismaTx) { ... }
export type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
