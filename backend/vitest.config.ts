import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// =============================================================================
// FinIA — Configuração do Vitest
// =============================================================================
//
// Resolução de path aliases feita aqui manualmente (decisão aprovada: sem
// vite-tsconfig-paths). Os mesmos aliases do tsconfig.json. O Vite resolve
// imports com extensão ".js" para os arquivos ".ts" correspondentes.
//
// Testes de integração usam Postgres/Redis reais; rodam sem paralelismo de
// arquivos para evitar corridas no banco. O setup carrega o .env e força
// NODE_ENV=test.
//
// =============================================================================

const r = (p: string): string => resolve(import.meta.dirname, p)

export default defineConfig({
  resolve: {
    alias: {
      '@config': r('src/config'),
      '@database': r('src/database'),
      '@cache': r('src/cache'),
      '@queue': r('src/queue'),
      '@modules': r('src/modules'),
      '@shared': r('src/shared'),
      '@tests': r('src/tests'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'],
    // Integração toca DB/Redis reais — sem paralelismo entre arquivos.
    fileParallelism: false,
    // Encerra o processo mesmo se algo deixar um handle aberto.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/modules/parse/**', 'src/shared/utils/**'],
      reporter: ['text', 'text-summary'],
    },
  },
})
