import { existsSync } from 'node:fs'

// =============================================================================
// FinIA — Setup global dos testes
// =============================================================================
//
// Carrega o .env (para os testes de integração que usam Postgres/Redis reais)
// e força NODE_ENV=test ANTES de qualquer módulo importar config/env.ts.
//
// process.loadEnvFile é nativo do Node (>=20.12) — sem dependência de dotenv.
//
// =============================================================================

if (!process.env.DATABASE_URL && existsSync('.env')) {
  process.loadEnvFile('.env')
}

process.env.NODE_ENV = 'test'
