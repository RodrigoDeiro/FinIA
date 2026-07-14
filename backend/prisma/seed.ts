import { PrismaClient, CategoryOrigin, TransactionType } from '@prisma/client'

// =============================================================================
// FinIA — Seed do Banco de Dados
// =============================================================================
//
// Popula dados imutáveis do sistema:
//   - 12 categorias do sistema (userId = null, origin = SYSTEM)
//   - ~55 merchants globais brasileiros (userId = null)
//
// Idempotente: pode ser executado múltiplas vezes — usa upsert por slug.
//
// Uso:
//   npm run db:seed
//   Ou dentro do container: docker-compose exec backend npm run db:seed
//
// =============================================================================

const prisma = new PrismaClient()

// =============================================================================
// CATEGORIAS DO SISTEMA
// =============================================================================
// 12 categorias fixas em português. Ícones do Lucide (https://lucide.dev/icons).
// Cores em hex sem '#'.

interface SystemCategory {
  slug:         string
  name:         string
  icon:         string
  color:        string
  applicableTo: TransactionType | null
}

const SYSTEM_CATEGORIES: SystemCategory[] = [
  { slug: 'alimentacao',    name: 'Alimentação',    icon: 'utensils',         color: 'FF6B6B', applicableTo: TransactionType.EXPENSE },
  { slug: 'transporte',     name: 'Transporte',     icon: 'car',              color: '4ECDC4', applicableTo: TransactionType.EXPENSE },
  { slug: 'moradia',        name: 'Moradia',        icon: 'home',             color: 'A78BFA', applicableTo: TransactionType.EXPENSE },
  { slug: 'saude',          name: 'Saúde',          icon: 'heart-pulse',      color: 'F87171', applicableTo: TransactionType.EXPENSE },
  { slug: 'educacao',       name: 'Educação',       icon: 'graduation-cap',   color: '60A5FA', applicableTo: TransactionType.EXPENSE },
  { slug: 'lazer',          name: 'Lazer',          icon: 'gamepad-2',        color: 'FBBF24', applicableTo: TransactionType.EXPENSE },
  { slug: 'assinaturas',    name: 'Assinaturas',    icon: 'repeat',           color: 'A855F7', applicableTo: TransactionType.EXPENSE },
  { slug: 'investimentos',  name: 'Investimentos',  icon: 'trending-up',      color: '10B981', applicableTo: TransactionType.INVESTMENT },
  { slug: 'receitas',       name: 'Receitas',       icon: 'circle-dollar-sign', color: '22C55E', applicableTo: TransactionType.INCOME },
  { slug: 'impostos',       name: 'Impostos',       icon: 'landmark',         color: '64748B', applicableTo: TransactionType.EXPENSE },
  { slug: 'compras',        name: 'Compras',        icon: 'shopping-bag',     color: 'EC4899', applicableTo: TransactionType.EXPENSE },
  { slug: 'outros',         name: 'Outros',         icon: 'circle-dot',       color: '9CA3AF', applicableTo: null },
]

// =============================================================================
// MERCHANTS GLOBAIS
// =============================================================================
// Marcas brasileiras conhecidas para lookup determinístico do parser.
// Slug normalizado: lowercase, sem espaços nem acentos.
// Aliases: variações comuns que aparecem em mensagens reais.

interface GlobalMerchant {
  name:         string
  slug:         string
  aliases:      string[]
  categorySlug: string
  defaultType:  TransactionType
}

const GLOBAL_MERCHANTS: GlobalMerchant[] = [
  // ─── Alimentação ─────────────────────────────────────────────────────────
  { name: 'iFood',          slug: 'ifood',           aliases: ['i food'],          categorySlug: 'alimentacao', defaultType: TransactionType.EXPENSE },
  { name: 'Rappi',          slug: 'rappi',           aliases: [],                  categorySlug: 'alimentacao', defaultType: TransactionType.EXPENSE },
  { name: 'Zé Delivery',    slug: 'zedelivery',      aliases: ['ze delivery', 'ze'], categorySlug: 'alimentacao', defaultType: TransactionType.EXPENSE },
  { name: "McDonald's",     slug: 'mcdonalds',       aliases: ['mc donalds', 'mc donald', 'mcdonald'], categorySlug: 'alimentacao', defaultType: TransactionType.EXPENSE },
  { name: 'Burger King',    slug: 'burgerking',      aliases: ['bk', 'burger king'], categorySlug: 'alimentacao', defaultType: TransactionType.EXPENSE },
  { name: 'Subway',         slug: 'subway',          aliases: [],                  categorySlug: 'alimentacao', defaultType: TransactionType.EXPENSE },
  { name: 'Habibs',         slug: 'habibs',          aliases: ['habib', "habib's"], categorySlug: 'alimentacao', defaultType: TransactionType.EXPENSE },
  { name: 'Pão de Açúcar',  slug: 'paodeacucar',     aliases: ['pao de acucar'],   categorySlug: 'alimentacao', defaultType: TransactionType.EXPENSE },
  { name: 'Carrefour',      slug: 'carrefour',       aliases: [],                  categorySlug: 'alimentacao', defaultType: TransactionType.EXPENSE },
  { name: 'Assaí',          slug: 'assai',           aliases: ['assai atacadista'], categorySlug: 'alimentacao', defaultType: TransactionType.EXPENSE },
  { name: 'Atacadão',       slug: 'atacadao',        aliases: [],                  categorySlug: 'alimentacao', defaultType: TransactionType.EXPENSE },
  { name: 'Extra',          slug: 'extra',           aliases: [],                  categorySlug: 'alimentacao', defaultType: TransactionType.EXPENSE },

  // ─── Transporte ──────────────────────────────────────────────────────────
  { name: 'Uber',           slug: 'uber',            aliases: ['uber eats', 'ubereats'], categorySlug: 'transporte', defaultType: TransactionType.EXPENSE },
  { name: '99',             slug: '99',              aliases: ['99 taxi', '99taxi', '99 app'], categorySlug: 'transporte', defaultType: TransactionType.EXPENSE },
  { name: 'Cabify',         slug: 'cabify',          aliases: [],                  categorySlug: 'transporte', defaultType: TransactionType.EXPENSE },
  { name: 'Shell',          slug: 'shell',           aliases: ['posto shell'],     categorySlug: 'transporte', defaultType: TransactionType.EXPENSE },
  { name: 'Ipiranga',       slug: 'ipiranga',        aliases: ['posto ipiranga'],  categorySlug: 'transporte', defaultType: TransactionType.EXPENSE },
  { name: 'Petrobras',      slug: 'petrobras',       aliases: ['br', 'posto br', 'posto petrobras'], categorySlug: 'transporte', defaultType: TransactionType.EXPENSE },
  { name: 'CCR',            slug: 'ccr',             aliases: ['pedagio', 'pedágio'], categorySlug: 'transporte', defaultType: TransactionType.EXPENSE },

  // ─── Moradia ──────────────────────────────────────────────────────────────
  { name: 'Vivo',           slug: 'vivo',            aliases: ['telefonica'],      categorySlug: 'moradia', defaultType: TransactionType.EXPENSE },
  { name: 'Claro',          slug: 'claro',           aliases: ['net', 'claro net'], categorySlug: 'moradia', defaultType: TransactionType.EXPENSE },
  { name: 'Oi',             slug: 'oi',              aliases: [],                  categorySlug: 'moradia', defaultType: TransactionType.EXPENSE },
  { name: 'TIM',            slug: 'tim',             aliases: [],                  categorySlug: 'moradia', defaultType: TransactionType.EXPENSE },
  { name: 'SKY',            slug: 'sky',             aliases: [],                  categorySlug: 'moradia', defaultType: TransactionType.EXPENSE },
  { name: 'Aluguel',        slug: 'aluguel',         aliases: [],                  categorySlug: 'moradia', defaultType: TransactionType.EXPENSE },
  { name: 'Condomínio',     slug: 'condominio',      aliases: ['condominio'],      categorySlug: 'moradia', defaultType: TransactionType.EXPENSE },

  // ─── Saúde ───────────────────────────────────────────────────────────────
  { name: 'Drogasil',       slug: 'drogasil',        aliases: [],                  categorySlug: 'saude', defaultType: TransactionType.EXPENSE },
  { name: 'Drogaria Pacheco', slug: 'pacheco',       aliases: ['drogaria pacheco'], categorySlug: 'saude', defaultType: TransactionType.EXPENSE },
  { name: 'Drogaria São Paulo', slug: 'drogariasaopaulo', aliases: ['drogaria sao paulo', 'sao paulo farmacia'], categorySlug: 'saude', defaultType: TransactionType.EXPENSE },
  { name: 'Raia',           slug: 'raia',            aliases: ['droga raia', 'drogaraia'], categorySlug: 'saude', defaultType: TransactionType.EXPENSE },
  { name: 'Unimed',         slug: 'unimed',          aliases: [],                  categorySlug: 'saude', defaultType: TransactionType.EXPENSE },
  { name: 'Bradesco Saúde', slug: 'bradescosaude',   aliases: ['bradesco saude'],  categorySlug: 'saude', defaultType: TransactionType.EXPENSE },
  { name: 'SulAmérica',     slug: 'sulamerica',      aliases: ['sul america'],     categorySlug: 'saude', defaultType: TransactionType.EXPENSE },

  // ─── Educação ────────────────────────────────────────────────────────────
  { name: 'Alura',          slug: 'alura',           aliases: [],                  categorySlug: 'educacao', defaultType: TransactionType.EXPENSE },
  { name: 'Hotmart',        slug: 'hotmart',         aliases: [],                  categorySlug: 'educacao', defaultType: TransactionType.EXPENSE },
  { name: 'Coursera',       slug: 'coursera',        aliases: [],                  categorySlug: 'educacao', defaultType: TransactionType.EXPENSE },
  { name: 'Udemy',          slug: 'udemy',           aliases: [],                  categorySlug: 'educacao', defaultType: TransactionType.EXPENSE },

  // ─── Lazer ───────────────────────────────────────────────────────────────
  { name: 'Cinemark',       slug: 'cinemark',        aliases: [],                  categorySlug: 'lazer', defaultType: TransactionType.EXPENSE },
  { name: 'Kinoplex',       slug: 'kinoplex',        aliases: [],                  categorySlug: 'lazer', defaultType: TransactionType.EXPENSE },

  // ─── Assinaturas ─────────────────────────────────────────────────────────
  { name: 'Netflix',        slug: 'netflix',         aliases: [],                  categorySlug: 'assinaturas', defaultType: TransactionType.EXPENSE },
  { name: 'Spotify',        slug: 'spotify',         aliases: [],                  categorySlug: 'assinaturas', defaultType: TransactionType.EXPENSE },
  { name: 'Amazon Prime',   slug: 'amazonprime',     aliases: ['prime video', 'amazon prime video'], categorySlug: 'assinaturas', defaultType: TransactionType.EXPENSE },
  { name: 'Disney+',        slug: 'disneyplus',      aliases: ['disney plus', 'disney +'], categorySlug: 'assinaturas', defaultType: TransactionType.EXPENSE },
  { name: 'YouTube Premium', slug: 'youtubepremium', aliases: ['youtube premium', 'yt premium'], categorySlug: 'assinaturas', defaultType: TransactionType.EXPENSE },
  { name: 'HBO Max',        slug: 'hbomax',          aliases: ['hbo', 'max', 'hbo max'], categorySlug: 'assinaturas', defaultType: TransactionType.EXPENSE },
  { name: 'Apple',          slug: 'apple',           aliases: ['icloud', 'app store', 'apple one'], categorySlug: 'assinaturas', defaultType: TransactionType.EXPENSE },
  { name: 'Google',         slug: 'google',          aliases: ['google one', 'google play'], categorySlug: 'assinaturas', defaultType: TransactionType.EXPENSE },

  // ─── Investimentos ───────────────────────────────────────────────────────
  { name: 'XP',             slug: 'xp',              aliases: ['xp investimentos', 'xp invest'], categorySlug: 'investimentos', defaultType: TransactionType.INVESTMENT },
  { name: 'Rico',           slug: 'rico',            aliases: ['rico invest'],     categorySlug: 'investimentos', defaultType: TransactionType.INVESTMENT },
  { name: 'Inter Invest',   slug: 'interinvest',     aliases: ['inter invest'],    categorySlug: 'investimentos', defaultType: TransactionType.INVESTMENT },
  { name: 'Tesouro Direto', slug: 'tesouro',         aliases: ['tesouro direto', 'tesouro nacional'], categorySlug: 'investimentos', defaultType: TransactionType.INVESTMENT },
  { name: 'Binance',        slug: 'binance',         aliases: [],                  categorySlug: 'investimentos', defaultType: TransactionType.INVESTMENT },
  { name: 'Mercado Bitcoin', slug: 'mercadobitcoin', aliases: ['mercado bitcoin', 'mb'], categorySlug: 'investimentos', defaultType: TransactionType.INVESTMENT },

  // ─── Compras ──────────────────────────────────────────────────────────────
  { name: 'Amazon',         slug: 'amazon',          aliases: ['amazon br', 'amazon brasil'], categorySlug: 'compras', defaultType: TransactionType.EXPENSE },
  { name: 'Mercado Livre',  slug: 'mercadolivre',    aliases: ['mercado livre', 'ml'], categorySlug: 'compras', defaultType: TransactionType.EXPENSE },
  { name: 'Shopee',         slug: 'shopee',          aliases: [],                  categorySlug: 'compras', defaultType: TransactionType.EXPENSE },
  { name: 'AliExpress',     slug: 'aliexpress',      aliases: ['ali express'],     categorySlug: 'compras', defaultType: TransactionType.EXPENSE },
  { name: 'Magazine Luiza', slug: 'magazineluiza',   aliases: ['magalu', 'magazine luiza'], categorySlug: 'compras', defaultType: TransactionType.EXPENSE },
  { name: 'Casas Bahia',    slug: 'casasbahia',      aliases: ['casas bahia'],     categorySlug: 'compras', defaultType: TransactionType.EXPENSE },
  { name: 'Americanas',     slug: 'americanas',      aliases: [],                  categorySlug: 'compras', defaultType: TransactionType.EXPENSE },
]

// =============================================================================
// EXECUÇÃO
// =============================================================================

async function seedCategories(): Promise<Map<string, string>> {
  console.log('\n🌱 Populando categorias do sistema...')

  // Mapa slug → id, retornado para uso no seed de merchants
  const slugToId = new Map<string, string>()

  for (const cat of SYSTEM_CATEGORIES) {
    // Idempotência via findFirst, NÃO via upsert na unique composta:
    // userId é null para categorias SYSTEM, e o Prisma 6 não aceita null
    // no where de uma unique composta (userId_slug). Além disso, no Postgres
    // valores NULL são distintos em índices unique, então a constraint
    // @@unique([userId, slug]) não impediria duplicatas SYSTEM por si só.
    const existing = await prisma.category.findFirst({
      where: { userId: null, slug: cat.slug },
    })

    const result = existing
      ? await prisma.category.update({
          where: { id: existing.id },
          data: {
            name:         cat.name,
            icon:         cat.icon,
            color:        cat.color,
            applicableTo: cat.applicableTo,
          },
        })
      : await prisma.category.create({
          data: {
            userId:       null,
            origin:       CategoryOrigin.SYSTEM,
            slug:         cat.slug,
            name:         cat.name,
            icon:         cat.icon,
            color:        cat.color,
            applicableTo: cat.applicableTo,
          },
        })

    slugToId.set(cat.slug, result.id)
    console.log(`  ✓ ${cat.name.padEnd(15)} (${cat.slug})`)
  }

  console.log(`✅ ${SYSTEM_CATEGORIES.length} categorias do sistema OK\n`)
  return slugToId
}

async function seedMerchants(categoryMap: Map<string, string>): Promise<void> {
  console.log('🌱 Populando merchants globais...')

  let count = 0
  for (const m of GLOBAL_MERCHANTS) {
    const categoryId = categoryMap.get(m.categorySlug)

    if (!categoryId) {
      console.error(`  ✗ Categoria não encontrada para ${m.name}: ${m.categorySlug}`)
      continue
    }

    // Mesmo padrão das categorias: findFirst + create/update (userId null)
    const existing = await prisma.merchant.findFirst({
      where: { userId: null, slug: m.slug },
    })

    if (existing) {
      await prisma.merchant.update({
        where: { id: existing.id },
        data: {
          name:        m.name,
          aliases:     m.aliases,
          categoryId,
          defaultType: m.defaultType,
        },
      })
    } else {
      await prisma.merchant.create({
        data: {
          userId:      null,
          name:        m.name,
          slug:        m.slug,
          aliases:     m.aliases,
          categoryId,
          defaultType: m.defaultType,
        },
      })
    }
    count++
  }

  console.log(`✅ ${count} merchants globais OK\n`)
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════')
  console.log('  FinIA — Database Seed')
  console.log('═══════════════════════════════════════════════════')

  const categoryMap = await seedCategories()
  await seedMerchants(categoryMap)

  console.log('═══════════════════════════════════════════════════')
  console.log('  ✅ Seed concluído com sucesso')
  console.log('═══════════════════════════════════════════════════\n')
}

main()
  .catch((error) => {
    console.error('\n❌ Erro durante o seed:')
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
