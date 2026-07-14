import type { FastifyInstance } from 'fastify'
import { eventBus, EVENTS, type TransactionEventPayload } from '@shared/events/event.bus.js'

// =============================================================================
// FinIA — Server-Sent Events (/api/v1/events)
// =============================================================================
//
// Decisão aprovada (§3): SSE, não WebSockets. O dashboard abre um EventSource
// e recebe transações criadas/alteradas em tempo real (ex: registrou um gasto
// no WhatsApp → aparece na tela na hora).
//
// Autenticação via cookie httpOnly (EventSource não envia headers custom, mas
// envia cookies). Cada conexão só recebe eventos do PRÓPRIO usuário.
//
// reply.hijack(): assumimos o socket manualmente — SSE é um stream infinito,
// fora do ciclo request/response padrão do Fastify.
//
// =============================================================================

const HEARTBEAT_MS = 25_000

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/events', (request, reply) => {
    const { userId } = request.auth!

    reply.hijack()
    const res = reply.raw

    // Headers manuais (hooks de resposta não rodam após hijack)
    const origin = request.headers.origin
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...(origin
        ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' }
        : {}),
    })

    // Reconexão automática do EventSource após 3s de queda
    res.write('retry: 3000\n\n')

    const forward = (eventName: string) => (payload: TransactionEventPayload) => {
      if (payload.userId !== userId) return // isolamento: só eventos do dono
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`)
    }

    const onCreated = forward(EVENTS.TRANSACTION_CREATED)
    const onUpdated = forward(EVENTS.TRANSACTION_UPDATED)
    const onDeleted = forward(EVENTS.TRANSACTION_DELETED)

    eventBus.on(EVENTS.TRANSACTION_CREATED, onCreated)
    eventBus.on(EVENTS.TRANSACTION_UPDATED, onUpdated)
    eventBus.on(EVENTS.TRANSACTION_DELETED, onDeleted)

    // Heartbeat: mantém proxies/load balancers de não matarem a conexão ociosa
    const heartbeat = setInterval(() => res.write(':hb\n\n'), HEARTBEAT_MS)

    request.raw.on('close', () => {
      clearInterval(heartbeat)
      eventBus.off(EVENTS.TRANSACTION_CREATED, onCreated)
      eventBus.off(EVENTS.TRANSACTION_UPDATED, onUpdated)
      eventBus.off(EVENTS.TRANSACTION_DELETED, onDeleted)
    })
  })
}
