import { prisma } from '@database/prisma.js'
import { ValidationError } from '@shared/errors/index.js'

// =============================================================================
// FinIA — Validadores compartilhados da API
// =============================================================================

/** Categoria precisa existir e ser do sistema OU do próprio usuário. */
export async function assertCategoryUsable(categoryId: string, userId: string): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, deletedAt: null, OR: [{ userId: null }, { userId }] },
    select: { id: true },
  })
  if (!category) throw new ValidationError('Categoria inválida')
}
