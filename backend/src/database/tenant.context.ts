import { AsyncLocalStorage } from 'node:async_hooks'

// =============================================================================
// FinIA — Tenant Context (AsyncLocalStorage)
// =============================================================================
//
// Guarda o usuário autenticado da requisição HTTP corrente sem passar userId
// por parâmetro em cada camada.
//
// COMO FUNCIONA (e por que assim): no Node 24 (AsyncContextFrame),
// `als.enterWith()` chamado dentro de um hook async NÃO propaga para o handler
// — o runner de hooks do Fastify retoma o frame antigo. O padrão correto é o
// do @fastify/request-context:
//
//   1. Um hook onRequest SÍNCRONO abre o escopo: als.run(store, done).
//      Como done() é chamado DENTRO do run, todo o restante do ciclo da
//      requisição (hooks, handler, awaits) herda o contexto.
//   2. O store nasce vazio ({ userId: null }); o guard de autenticação o MUTA
//      quando identifica o usuário.
//
// O pipeline de WhatsApp (workers) não usa este contexto — lá o userId é
// explícito por mensagem.
//
// =============================================================================

interface TenantStore {
  userId: string | null
}

const storage = new AsyncLocalStorage<TenantStore>()

/**
 * Abre o escopo de tenant para uma requisição. Uso EXCLUSIVO no hook
 * onRequest (forma callback):
 *
 *   app.addHook('onRequest', (req, reply, done) => openTenantScope(done))
 */
export function openTenantScope(done: () => void): void {
  storage.run({ userId: null }, done)
}

/**
 * Define o usuário do escopo corrente (chamado pelo guard após autenticar).
 * Lança se o escopo não foi aberto — significa que o hook onRequest do
 * auth.module não está registrado.
 */
export function setTenantUserId(userId: string): void {
  const store = storage.getStore()
  if (!store) {
    throw new Error(
      'Tenant scope não aberto. O hook onRequest do auth.module está registrado?',
    )
  }
  store.userId = userId
}

/** Usuário do contexto corrente, ou null fora de uma requisição autenticada. */
export function getTenantUserId(): string | null {
  return storage.getStore()?.userId ?? null
}

/** Executa fn dentro de um contexto de tenant (útil em testes/scripts). */
export function runWithTenant<T>(userId: string, fn: () => T): T {
  return storage.run({ userId }, fn)
}
