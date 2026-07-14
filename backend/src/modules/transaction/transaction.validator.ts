import { z } from 'zod'
import { TransactionType } from '@prisma/client'
import { ValidationError } from '@shared/errors/index.js'

// =============================================================================
// FinIA — Transaction Validator
// =============================================================================
//
// Valida os campos essenciais antes de persistir. Defesa final mesmo quando os
// dados vêm do parser — garante invariantes do domínio (valor positivo,
// moeda ISO de 3 letras, descrição dentro do limite da coluna, etc.).
//
// =============================================================================

const createTransactionSchema = z.object({
  amount: z
    .number({ invalid_type_error: 'amount deve ser número' })
    .finite('amount deve ser finito')
    .positive('amount deve ser positivo'),
  type: z.nativeEnum(TransactionType),
  date: z.date({ invalid_type_error: 'date deve ser Date' }),
  description: z.string().max(500).nullish(),
  merchantName: z.string().max(120).nullish(),
  originalText: z.string().max(1000).nullish(),
  currency: z.string().length(3).default('BRL'),
  parseConfidence: z.number().min(0).max(1).nullish(),
})

export type ValidatedTransaction = z.infer<typeof createTransactionSchema>

/**
 * Valida e normaliza os campos da transação. Lança ValidationError (422) com a
 * lista de problemas se algo estiver inválido.
 */
export function validateTransaction(input: unknown): ValidatedTransaction {
  const result = createTransactionSchema.safeParse(input)
  if (!result.success) {
    throw new ValidationError('Transação inválida', result.error.flatten().fieldErrors)
  }
  return result.data
}
