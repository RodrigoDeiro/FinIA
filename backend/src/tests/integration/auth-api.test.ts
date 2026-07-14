import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { LightMyRequestResponse } from 'fastify'
import { buildApp } from '../../app.js'
import { prisma, disconnectDatabase } from '@database/prisma.js'
import { disconnectRedis } from '@cache/redis.js'
import { closeQueues } from '@queue/queues.js'
import { createMagicLink } from '@modules/auth/magic-link.service.js'

// =============================================================================
// FinIA — Integração: Auth + API (/api/v1)
// =============================================================================
//
// Usa Postgres e Redis REAIS (containers de dev) via app.inject — sem abrir
// porta. Cobre o fluxo do Sprint 3 de ponta a ponta:
//
//   magic link → cookies → API protegida → isolamento de tenant →
//   soft delete → rotação de refresh → detecção de reuso (roubo)
//
// =============================================================================

const PHONE_A = '+5511900000001'
const PHONE_B = '+5511900000002'

let app: FastifyInstance
let userAId: string
let userBId: string
let outrosCategoryId: string

function cookiesOf(res: LightMyRequestResponse): Record<string, string> {
  return Object.fromEntries(res.cookies.map((c) => [c.name, c.value]))
}

async function cleanupUsers(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { phoneNumber: { in: [PHONE_A, PHONE_B] } },
    select: { id: true },
  })
  const ids = users.map((u) => u.id)
  if (ids.length === 0) return
  await prisma.transaction.deleteMany({ where: { userId: { in: ids } } })
  await prisma.session.deleteMany({ where: { userId: { in: ids } } })
  await prisma.account.deleteMany({ where: { userId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
}

/** Faz o login completo via magic link e retorna os cookies. */
async function login(userId: string): Promise<Record<string, string>> {
  const url = await createMagicLink(userId)
  const token = new URL(url).searchParams.get('token')!
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/magic',
    payload: { token },
  })
  expect(res.statusCode).toBe(200)
  return cookiesOf(res)
}

beforeAll(async () => {
  app = await buildApp()
  await cleanupUsers()

  const category = await prisma.category.findFirst({ where: { userId: null, slug: 'outros' } })
  outrosCategoryId = category!.id

  const userA = await prisma.user.create({
    data: {
      phoneNumber: PHONE_A,
      accounts: { create: { name: 'Principal', isDefault: true } },
    },
    include: { accounts: true },
  })
  userAId = userA.id

  const userB = await prisma.user.create({
    data: {
      phoneNumber: PHONE_B,
      accounts: { create: { name: 'Principal', isDefault: true } },
    },
    include: { accounts: true },
  })
  userBId = userB.id

  // Transação do usuário B — o usuário A NÃO pode vê-la
  await prisma.transaction.create({
    data: {
      userId: userBId,
      accountId: userB.accounts[0].id,
      categoryId: outrosCategoryId,
      type: 'EXPENSE',
      amount: 42,
      date: new Date(),
      description: 'segredo do usuário B',
    },
  })
}, 30_000)

afterAll(async () => {
  await cleanupUsers()
  await app.close()
  await closeQueues()
  await disconnectRedis()
  await disconnectDatabase()
}, 30_000)

describe('magic link', () => {
  it('token válido → 200 + cookies httpOnly', async () => {
    const url = await createMagicLink(userAId)
    const token = new URL(url).searchParams.get('token')!

    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/magic', payload: { token } })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.phoneNumber).toBe(PHONE_A)

    const cookies = res.cookies
    const access = cookies.find((c) => c.name === 'finia_access')
    const refresh = cookies.find((c) => c.name === 'finia_refresh')
    expect(access?.httpOnly).toBe(true)
    expect(refresh?.httpOnly).toBe(true)
    expect(refresh?.path).toBe('/api/v1/auth')
  })

  it('token é de USO ÚNICO — segundo consumo falha', async () => {
    const url = await createMagicLink(userAId)
    const token = new URL(url).searchParams.get('token')!

    const first = await app.inject({ method: 'POST', url: '/api/v1/auth/magic', payload: { token } })
    expect(first.statusCode).toBe(200)

    const replay = await app.inject({ method: 'POST', url: '/api/v1/auth/magic', payload: { token } })
    expect(replay.statusCode).toBe(401)
  })

  it('token inventado → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic',
      payload: { token: 'x'.repeat(64) },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('API protegida + isolamento de tenant', () => {
  it('sem cookie → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/me' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /me devolve o usuário logado', async () => {
    const cookies = await login(userAId)
    const res = await app.inject({ method: 'GET', url: '/api/v1/me', cookies })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.phoneNumber).toBe(PHONE_A)
    expect(res.json().accounts).toHaveLength(1)
  })

  it('cria, lista, edita e soft-deleta transação — sem vazar dados do outro usuário', async () => {
    const cookies = await login(userAId)

    // CREATE
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      cookies,
      payload: {
        type: 'EXPENSE',
        amount: 99.9,
        date: new Date().toISOString(),
        description: 'teclado novo',
        categoryId: outrosCategoryId,
      },
    })
    expect(created.statusCode).toBe(201)
    const txId = created.json().id
    expect(created.json().amount).toBe(99.9)

    // LIST — só a transação do próprio usuário (a do B não aparece)
    const list = await app.inject({ method: 'GET', url: '/api/v1/transactions', cookies })
    expect(list.statusCode).toBe(200)
    const items = list.json().items as Array<{ id: string; description: string | null }>
    expect(items.some((t) => t.id === txId)).toBe(true)
    expect(items.some((t) => t.description === 'segredo do usuário B')).toBe(false)

    // PATCH
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/transactions/${txId}`,
      cookies,
      payload: { amount: 120, needsReview: false },
    })
    expect(patched.statusCode).toBe(200)
    expect(patched.json().amount).toBe(120)

    // DELETE (soft)
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/transactions/${txId}`,
      cookies,
    })
    expect(deleted.statusCode).toBe(204)

    // Sumiu da listagem…
    const after = await app.inject({ method: 'GET', url: '/api/v1/transactions', cookies })
    const remaining = after.json().items as Array<{ id: string }>
    expect(remaining.some((t) => t.id === txId)).toBe(false)

    // …mas continua no banco com deletedAt (soft delete, não hard)
    const row = await prisma.transaction.findUnique({ where: { id: txId } })
    expect(row?.deletedAt).not.toBeNull()
  })

  it('usuário A não consegue editar transação do usuário B (404, não 403 — sem vazar existência)', async () => {
    const cookies = await login(userAId)
    const txB = await prisma.transaction.findFirst({ where: { userId: userBId } })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/transactions/${txB!.id}`,
      cookies,
      payload: { amount: 1 },
    })
    expect(res.statusCode).toBe(404)

    // valor intacto
    const untouched = await prisma.transaction.findUnique({ where: { id: txB!.id } })
    expect(Number(untouched!.amount)).toBe(42)
  })

  it('GET /categories inclui as 12 do sistema', async () => {
    const cookies = await login(userAId)
    const res = await app.inject({ method: 'GET', url: '/api/v1/categories', cookies })
    expect(res.statusCode).toBe(200)
    expect(res.json().categories.length).toBeGreaterThanOrEqual(12)
  })

  it('GET /summary devolve o snapshot do mês', async () => {
    const cookies = await login(userAId)
    const res = await app.inject({ method: 'GET', url: '/api/v1/summary', cookies })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('mesAtual.totalGastos')
  })
})

describe('refresh com rotação e detecção de roubo', () => {
  it('refresh troca o token; o antigo reutilizado revoga a sessão inteira', async () => {
    const first = await login(userAId)
    const oldRefresh = first.finia_refresh

    // 1º refresh: OK, novo par de cookies
    const rotated = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { finia_refresh: oldRefresh },
    })
    expect(rotated.statusCode).toBe(204)
    const newCookies = cookiesOf(rotated)
    expect(newCookies.finia_refresh).toBeTruthy()
    expect(newCookies.finia_refresh).not.toBe(oldRefresh)

    // REPLAY do token antigo → 401 + sessão revogada
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { finia_refresh: oldRefresh },
    })
    expect(replay.statusCode).toBe(401)

    // Até o token NOVO morre (sessão inteira foi revogada por segurança)
    const afterTheft = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { finia_refresh: newCookies.finia_refresh },
    })
    expect(afterTheft.statusCode).toBe(401)

    // E o access token da sessão revogada também para de funcionar
    const apiAccess = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      cookies: { finia_access: newCookies.finia_access ?? first.finia_access },
    })
    expect(apiAccess.statusCode).toBe(401)
  })

  it('logout revoga a sessão e o access token morre na hora', async () => {
    const cookies = await login(userAId)

    const out = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', cookies })
    expect(out.statusCode).toBe(204)

    const after = await app.inject({ method: 'GET', url: '/api/v1/me', cookies })
    expect(after.statusCode).toBe(401)
  })

  it('lista sessões ativas e revoga uma específica', async () => {
    const c1 = await login(userAId)
    await login(userAId) // segunda sessão

    const list = await app.inject({ method: 'GET', url: '/api/v1/auth/sessions', cookies: c1 })
    expect(list.statusCode).toBe(200)
    const sessions = list.json().sessions as Array<{ id: string; current: boolean }>
    expect(sessions.length).toBeGreaterThanOrEqual(2)

    const other = sessions.find((s) => !s.current)!
    const revoke = await app.inject({
      method: 'POST',
      url: `/api/v1/auth/sessions/${other.id}/revoke`,
      cookies: c1,
    })
    expect(revoke.statusCode).toBe(204)
  })
})
