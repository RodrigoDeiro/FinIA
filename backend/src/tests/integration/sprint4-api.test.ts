import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { prisma, disconnectDatabase } from '@database/prisma.js'
import { disconnectRedis } from '@cache/redis.js'
import { closeQueues } from '@queue/queues.js'
import { createMagicLink } from '@modules/auth/magic-link.service.js'
import { runInsightEngine } from '@modules/insight/insight.engine.js'
import { requestMonthlyReport, generateReport } from '@modules/report/report.service.js'
import { dayjs } from '@shared/utils/date.util.js'

// =============================================================================
// FinIA — Integração: Sprint 4 (budgets, metas, insights, relatórios)
// =============================================================================

const PHONE = '+5511900000044'

let app: FastifyInstance
let userId: string
let accountId: string
let alimentacaoId: string
let cookies: Record<string, string>

async function cleanup(): Promise<void> {
  const user = await prisma.user.findFirst({ where: { phoneNumber: PHONE } })
  if (!user) return
  await prisma.transaction.deleteMany({ where: { userId: user.id } })
  await prisma.aIInsight.deleteMany({ where: { userId: user.id } })
  await prisma.report.deleteMany({ where: { userId: user.id } })
  await prisma.budget.deleteMany({ where: { userId: user.id } })
  await prisma.goal.deleteMany({ where: { userId: user.id } })
  await prisma.session.deleteMany({ where: { userId: user.id } })
  await prisma.account.deleteMany({ where: { userId: user.id } })
  await prisma.user.delete({ where: { id: user.id } })
}

beforeAll(async () => {
  app = await buildApp()
  await cleanup()

  const cat = await prisma.category.findFirst({ where: { userId: null, slug: 'alimentacao' } })
  alimentacaoId = cat!.id

  const user = await prisma.user.create({
    data: { phoneNumber: PHONE, accounts: { create: { name: 'Principal', isDefault: true } } },
    include: { accounts: true },
  })
  userId = user.id
  accountId = user.accounts[0].id

  // Transações: mês anterior R$100 e mês atual R$300 em alimentação (+200%)
  const nowTz = dayjs().tz('America/Sao_Paulo')
  await prisma.transaction.createMany({
    data: [
      {
        userId,
        accountId,
        categoryId: alimentacaoId,
        type: 'EXPENSE',
        amount: 100,
        date: nowTz.subtract(1, 'month').startOf('month').add(5, 'day').utc().toDate(),
      },
      { userId, accountId, categoryId: alimentacaoId, type: 'EXPENSE', amount: 180, date: new Date() },
      { userId, accountId, categoryId: alimentacaoId, type: 'EXPENSE', amount: 120, date: new Date() },
      { userId, accountId, categoryId: alimentacaoId, type: 'INCOME', amount: 2000, date: new Date() },
    ],
  })

  const url = await createMagicLink(userId)
  const token = new URL(url).searchParams.get('token')!
  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/magic', payload: { token } })
  cookies = Object.fromEntries(login.cookies.map((c) => [c.name, c.value]))
}, 30_000)

afterAll(async () => {
  await cleanup()
  await app.close()
  await closeQueues()
  await disconnectRedis()
  await disconnectDatabase()
}, 30_000)

describe('budgets', () => {
  let budgetId: string

  it('cria orçamento e lista com status calculado', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/budgets',
      cookies,
      payload: { categoryId: alimentacaoId, amount: 400, alertThreshold: 0.8 },
    })
    expect(created.statusCode).toBe(201)
    budgetId = created.json().id

    const list = await app.inject({ method: 'GET', url: '/api/v1/budgets', cookies })
    expect(list.statusCode).toBe(200)
    const budget = list.json().budgets[0]
    expect(budget.categoryName).toBe('Alimentação')
    expect(budget.spent).toBe(300) // 180 + 120 do mês atual
    expect(budget.ratio).toBe(0.75)
    expect(budget.remaining).toBe(100)
  })

  it('rejeita orçamento duplicado (mesma categoria + período)', async () => {
    const dup = await app.inject({
      method: 'POST',
      url: '/api/v1/budgets',
      cookies,
      payload: { categoryId: alimentacaoId, amount: 999 },
    })
    expect(dup.statusCode).toBe(422)
  })

  it('atualiza e soft-deleta', async () => {
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/budgets/${budgetId}`,
      cookies,
      payload: { amount: 500 },
    })
    expect(patched.statusCode).toBe(200)

    const deleted = await app.inject({ method: 'DELETE', url: `/api/v1/budgets/${budgetId}`, cookies })
    expect(deleted.statusCode).toBe(204)

    const list = await app.inject({ method: 'GET', url: '/api/v1/budgets', cookies })
    expect(list.json().budgets).toHaveLength(0)
  })
})

describe('goals', () => {
  it('cria meta, deposita e atinge (status ACHIEVED)', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/goals',
      cookies,
      payload: { name: 'Reserva de emergência', targetAmount: 1000 },
    })
    expect(created.statusCode).toBe(201)
    const goalId = created.json().id

    const d1 = await app.inject({
      method: 'POST',
      url: `/api/v1/goals/${goalId}/deposit`,
      cookies,
      payload: { amount: 400 },
    })
    expect(d1.json()).toMatchObject({ currentAmount: 400, achieved: false })

    const d2 = await app.inject({
      method: 'POST',
      url: `/api/v1/goals/${goalId}/deposit`,
      cookies,
      payload: { amount: 600 },
    })
    expect(d2.json()).toMatchObject({ currentAmount: 1000, achieved: true })

    const list = await app.inject({ method: 'GET', url: '/api/v1/goals', cookies })
    const goal = list.json().goals.find((g: { id: string }) => g.id === goalId)
    expect(goal.status).toBe('ACHIEVED')
    expect(goal.progress).toBe(1)
  })
})

describe('insight engine', () => {
  it('gera insights determinísticos (aumento de gasto detectado) com dedupe', async () => {
    const first = await runInsightEngine(userId, 'demand')
    expect(first.created).toBeGreaterThanOrEqual(1)

    // Rodar de novo não duplica
    const second = await runInsightEngine(userId, 'demand')
    expect(second.created).toBe(0)
    expect(second.skippedDuplicates).toBeGreaterThanOrEqual(1)

    const list = await app.inject({ method: 'GET', url: '/api/v1/insights', cookies })
    const insights = list.json().insights as Array<{ id: string; type: string; title: string }>
    const increase = insights.find((i) => i.type === 'SPENDING_INCREASE')
    expect(increase).toBeDefined()
    expect(increase!.title).toContain('Alimentação')

    // marcar como visto
    const seen = await app.inject({
      method: 'PATCH',
      url: `/api/v1/insights/${increase!.id}/seen`,
      cookies,
    })
    expect(seen.statusCode).toBe(200)
  })
})

describe('reports', () => {
  it('gera relatório mensal e baixa o HTML', async () => {
    // Cria a requisição + processa direto (sem esperar o worker)
    const report = await requestMonthlyReport(userId)
    expect(report.status).toBe('PENDING')

    await generateReport(report.id)

    const row = await prisma.report.findUnique({ where: { id: report.id } })
    expect(row?.status).toBe('COMPLETED')
    expect(row?.fileSize).toBeGreaterThan(1000)

    const list = await app.inject({ method: 'GET', url: '/api/v1/reports', cookies })
    expect(list.json().reports[0].status).toBe('COMPLETED')

    const download = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/${report.id}/download`,
      cookies,
    })
    expect(download.statusCode).toBe(200)
    expect(download.headers['content-type']).toContain('text/html')
    expect(download.body).toContain('FinIA')
    expect(download.body).toContain('Alimentação')
    expect(download.body).toContain('2.000,00') // entradas
  })
})
