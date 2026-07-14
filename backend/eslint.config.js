// =============================================================================
// FinIA — ESLint 9 (flat config)
// =============================================================================
//
// Flat config é o formato padrão a partir do ESLint 9 (eslint.config.js).
// Usa @typescript-eslint/parser + plugin diretamente (sem o meta-pacote
// typescript-eslint), espelhando as devDependencies do package.json.
//
// Filosofia: type-checking pesado fica no `tsc` (typecheck/build). O ESLint
// foca em correção lógica e consistência — sem exigir o type-checker
// (projectService), o que mantém o lint rápido no lint-staged/Husky.
// =============================================================================

import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  // Ignora artefatos e gerados — não lintamos o que não é fonte
  {
    ignores: ['dist/**', 'node_modules/**', 'prisma/migrations/**', 'coverage/**'],
  },

  // Regras recomendadas do ESLint core
  js.configs.recommended,

  // ─── TypeScript (fonte + seed) ─────────────────────────────────────────────
  {
    files: ['src/**/*.ts', 'prisma/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // Parâmetros/vars não usados: erro, exceto prefixados com _
      // (espelha noUnusedParameters do tsconfig.build.json)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // no-undef é redundante e gera falsos positivos em TS (o tsc já cobre)
      'no-undef': 'off',

      // console é esperado em seed/scripts; o logger (Pino) cobre o runtime
      'no-console': 'off',
    },
  },
]
