import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { hmacSha256Hex } from '@shared/utils/crypto.util.js'
import { randomToken } from '@shared/utils/crypto.util.js'
import { messageQueue, closeQueues } from '@queue/queues.js'
import { disconnectRedis } from '@cache/redis.js'
import { disconnectDatabase } from '@database/prisma.js'

// =============================================================================
// FinIA — Teste de Integração: Webhook
// =============================================================================
//
// Exercita o endpoint POST /webhook/evolution via app.inject (sem porta real):
// validação HMAC, eventos ignorados e idempotência. Usa Redis real (idempotência
// e enfileiramento). Não sobe workers — só verifica o contrato HTTP.
//
// =============================================================================

const SECRET = process.env.EVOLUTION_WEBHOOK_SECRET ?? ''

function buildPayload(messageId: string, text = 'iFood 45,90'): string {
  return JSON.stringify({
    event: 'messages.upsert',
    instance: 'finia',
    data: {
      key: { remoteJid: '5511912345678@s.whatsapp.net', fromMe: false, id: messageId },
      message: { conversation: text },
      messageType: 'conversation',
      messageTimestamp: 1719200000,
    },
  })
}

function signedHeaders(body: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-evolution-signature': hmacSha256Hex(body, SECRET),
  }
}

describe('POST /webhook/evolution', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
    await messageQueue.obliterate({ force: true })
    await closeQueues()
    await disconnectRedis()
    await disconnectDatabase()
  })

  it('aceita assinatura válida e enfileira (200 queued)', async () => {
    const body = buildPayload(`it-valid-${randomToken(6)}`)
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      headers: signedHeaders(body),
      payload: body,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'queued' })
  })

  it('rejeita assinatura inválida (401)', async () => {
    const body = buildPayload(`it-bad-${randomToken(6)}`)
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      headers: { 'content-type': 'application/json', 'x-evolution-signature': 'deadbeef' },
      payload: body,
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejeita sem assinatura (401)', async () => {
    const body = buildPayload(`it-nosig-${randomToken(6)}`)
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      headers: { 'content-type': 'application/json' },
      payload: body,
    })
    expect(res.statusCode).toBe(401)
  })

  it('ignora evento que não é mensagem (200 ignored)', async () => {
    const body = JSON.stringify({ event: 'connection.update', instance: 'finia', data: {} })
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      headers: signedHeaders(body),
      payload: body,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ignored' })
  })

  it('descarta duplicata pelo mesmo messageId (200 duplicate)', async () => {
    const id = `it-dup-${randomToken(6)}`
    const body = buildPayload(id)
    const headers = signedHeaders(body)

    const first = await app.inject({ method: 'POST', url: '/webhook/evolution', headers, payload: body })
    expect(first.json()).toMatchObject({ status: 'queued' })

    const second = await app.inject({ method: 'POST', url: '/webhook/evolution', headers, payload: body })
    expect(second.json()).toMatchObject({ status: 'duplicate' })
  })
})
