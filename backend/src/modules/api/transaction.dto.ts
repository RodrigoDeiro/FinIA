import type { Transaction } from '@prisma/client'

// =============================================================================
// FinIA — DTOs da API
// =============================================================================
//
// Converte modelos do Prisma para o formato JSON da API:
//   - Decimal → number (Decimal serializa como string por padrão)
//   - Date → ISO 8601
//   - Sem campos internos (deletedAt, originalText fica — é útil no dashboard)
//
// =============================================================================

export interface TransactionDTO {
  id: string
  type: Transaction['type']
  amount: number
  currency: string
  date: string
  description: string | null
  merchantName: string | null
  categoryId: string
  categoryName: string | null
  accountId: string
  needsReview: boolean
  parseMethod: Transaction['parseMethod']
  parseConfidence: number | null
  createdAt: string
}

type TransactionWithCategory = Transaction & { category?: { name: string } | null }

export function toTransactionDTO(t: TransactionWithCategory): TransactionDTO {
  return {
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    currency: t.currency,
    date: t.date.toISOString(),
    description: t.description,
    merchantName: t.merchantName,
    categoryId: t.categoryId,
    categoryName: t.category?.name ?? null,
    accountId: t.accountId,
    needsReview: t.needsReview,
    parseMethod: t.parseMethod,
    parseConfidence: t.parseConfidence === null ? null : Number(t.parseConfidence),
    createdAt: t.createdAt.toISOString(),
  }
}
