import type { FastifyReply, FastifyRequest } from 'fastify'
import type { IWhatsAppProvider } from './providers/whatsapp.provider.interface.js'
import { cacheService } from '@cache/cache.service.js'
import { messageQueue } from '@queue/queues.js'
import { MESSAGE_JOB_NAME } from '@queue/jobs/message.job.js'
import { REDIS_KEYS, TTL } from '@config/constants.js'

// =============================================================================
// FinIA — WhatsApp Webhook Controller
// =============================================================================
//
// Fluxo (anti-padrão #7: NUNCA processar webhook de forma síncrona):
//   1. Valida a assinatura HMAC sobre o corpo bruto → 401 se inválida.
//   2. Normaliza o payload → ignora (200) eventos que não são mensagens.
//   3. Ignora mensagens enviadas por nós mesmos (fromMe).
//   4. Idempotência: marca o messageId no Redis (SET NX). Duplicata → 200.
//   5. Enfileira o job e responde 200 IMEDIATAMENTE.
//
// O processamento real (parse, transação, resposta) acontece no worker.
//
// =============================================================================

export function createWhatsAppController(provider: IWhatsAppProvider) {
  async function handleWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const signature = request.headers['x-evolution-signature'] as string | undefined
    // Token estático que a Evolution envia via headers do webhook (ela não gera
    // HMAC). O provider aceita HMAC OU token — ver evolution.provider.ts.
    const token = request.headers['x-finia-token'] as string | undefined
    const rawBody = request.rawBody ?? ''

    // 1. Autenticação do webhook (HMAC ou token estático)
    if (!provider.verifySignature(rawBody, signature, token)) {
      request.log.warn('Webhook: autenticação inválida — requisição rejeitada')
      await reply.code(401).send({ error: 'invalid_signature' })
      return
    }

    // 2. Normalização
    const normalized = provider.parseWebhook(request.body)
    if (!normalized) {
      // Evento que não é mensagem processável (status, conexão, etc.)
      await reply.code(200).send({ status: 'ignored' })
      return
    }

    // 3. Echo da própria instância
    if (normalized.fromMe) {
      await reply.code(200).send({ status: 'ignored_self' })
      return
    }

    // 4. Idempotência (Redis SET NX)
    const isFirst = await cacheService.markIfFirst(
      REDIS_KEYS.idempotency(normalized.provider, normalized.providerMessageId),
      TTL.IDEMPOTENCY,
    )
    if (!isFirst) {
      request.log.info(
        { messageId: normalized.providerMessageId },
        'Webhook: mensagem duplicada descartada',
      )
      await reply.code(200).send({ status: 'duplicate' })
      return
    }

    // 5. Enfileira e responde imediatamente
    await messageQueue.add(MESSAGE_JOB_NAME, { normalized })
    request.log.info(
      { from: normalized.from, messageId: normalized.providerMessageId },
      'Webhook: mensagem enfileirada',
    )
    await reply.code(200).send({ status: 'queued' })
  }

  return { handleWebhook }
}
