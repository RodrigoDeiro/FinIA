import { prisma } from '@database/prisma.js'

// =============================================================================
// FinIA — Category Resolver (sistema)
// =============================================================================
//
// Carrega as 12 categorias do sistema (userId = null) e expõe:
//   - a lista de slugs (para restringir a saída da IA)
//   - um mapa slug → id (para resolver a categoria escolhida pela IA)
//
// Categorias do sistema são imutáveis → cache em memória pelo processo.
//
// =============================================================================

interface SystemCategories {
  slugs: string[]
  slugToId: Map<string, string>
  /** slug → nome de exibição (ex: 'alimentacao' → 'Alimentação') */
  slugToName: Map<string, string>
}

let cache: SystemCategories | null = null

export async function getSystemCategories(): Promise<SystemCategories> {
  if (cache) return cache

  const rows = await prisma.category.findMany({
    where: { userId: null },
    select: { id: true, slug: true, name: true },
  })

  cache = {
    slugs: rows.map((r) => r.slug),
    slugToId: new Map(rows.map((r) => [r.slug, r.id])),
    slugToName: new Map(rows.map((r) => [r.slug, r.name])),
  }
  return cache
}
