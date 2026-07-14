import { prisma } from './prisma.js'
import { getTenantUserId } from './tenant.context.js'

// =============================================================================
// FinIA — Tenant Prisma (extensão de isolamento)
// =============================================================================
//
// Cliente Prisma usado pela API WEB (/api/v1). Em toda operação sobre modelos
// tenant-scoped ele:
//
//   1. LANÇA se não houver tenant no contexto (nunca roda "sem dono").
//   2. Injeta `userId` no where de leituras/escritas em lote — um usuário não
//      consegue ler/alterar dados de outro nem construindo o filtro à mão.
//   3. Injeta `userId` no data de creates.
//   4. Filtra `deletedAt: null` automaticamente (soft delete) nas leituras,
//      a menos que a query já mencione deletedAt explicitamente.
//   5. BLOQUEIA operações por chave única (findUnique/update/delete/upsert)
//      nesses modelos: elas não passam pelo filtro de tenant. Use
//      findFirst/updateMany/deleteMany — count === 0 equivale a 404.
//
// O pipeline de WhatsApp continua no client base (`prisma`): lá o userId é
// explícito por mensagem. Este client é a camada de defesa da superfície web.
//
// =============================================================================

// Modelos com coluna userId obrigatória (dados de UM usuário).
// Category e Merchant ficam FORA: são dual-mode (linhas de sistema com
// userId=null) — injetar userId esconderia as linhas do sistema.
const TENANT_MODELS = new Set([
  'Transaction',
  'Account',
  'Budget',
  'Goal',
  'AIInsight',
  'Report',
  'Session',
])

// Modelos tenant-scoped com soft delete (deletedAt)
const SOFT_DELETE_MODELS = new Set(['Transaction', 'Account', 'Budget', 'Goal'])

// Operações que recebem `where` filtrável
const FILTERED_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
])

// Operações por chave única — não passam pelo filtro de tenant → proibidas
const UNIQUE_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
  'upsert',
])

const READ_OPS = new Set(['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'])

type QueryArgs = {
  where?: Record<string, unknown>
  data?: Record<string, unknown> | Array<Record<string, unknown>>
}

export const tenantPrisma = prisma.$extends({
  name: 'tenant-isolation',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_MODELS.has(model)) {
          return query(args)
        }

        const userId = getTenantUserId()
        if (!userId) {
          throw new Error(
            `tenantPrisma: operação ${model}.${operation} fora de contexto de tenant. ` +
              'A rota está protegida pelo guard de autenticação?',
          )
        }

        if (UNIQUE_OPS.has(operation)) {
          throw new Error(
            `tenantPrisma: ${model}.${operation} é uma operação por chave única e não passa ` +
              'pelo filtro de tenant. Use findFirst/updateMany/deleteMany (count 0 ⇒ 404).',
          )
        }

        const a = args as QueryArgs

        if (FILTERED_OPS.has(operation)) {
          // Força o dono — sobrescreve qualquer userId vindo do chamador
          a.where = { ...(a.where ?? {}), userId }

          // Soft delete automático nas leituras (a menos que a query já trate)
          if (
            READ_OPS.has(operation) &&
            SOFT_DELETE_MODELS.has(model) &&
            !('deletedAt' in a.where)
          ) {
            a.where.deletedAt = null
          }
        }

        // create/createMany: carimba o dono nos dados
        if (operation === 'create' && a.data && !Array.isArray(a.data)) {
          a.data.userId = userId
        }
        if (operation === 'createMany' && Array.isArray(a.data)) {
          for (const row of a.data) row.userId = userId
        }

        return query(args)
      },
    },
  },
})

export type TenantPrisma = typeof tenantPrisma
