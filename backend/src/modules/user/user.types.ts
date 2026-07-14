import type { Prisma } from '@prisma/client'

// =============================================================================
// FinIA — Tipos do módulo User
// =============================================================================

/** Usuário com suas contas incluídas (retorno do onboarding). */
export type UserWithAccounts = Prisma.UserGetPayload<{
  include: { accounts: true }
}>
