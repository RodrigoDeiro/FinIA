import { prisma } from '@database/prisma.js'
import { logger } from '@config/logger.js'
import type { NormalizedMessage } from '@modules/whatsapp/types/normalized-message.type.js'
import { findOrCreateByPhone } from '@modules/user/user.service.js'
import { orchestrateParse } from '@modules/parse/parse.orchestrator.js'
import { createTransaction } from '@modules/transaction/transaction.service.js'
import * as notificationService from '@modules/notification/notification.service.js'
import {
  transactionConfirmationTemplate,
  notUnderstoodTemplate,
  mediaUnsupportedTemplate,
} from '@modules/notification/templates/index.js'
import { parseWithAI } from '@modules/ai/ai.orchestrator.js'
import { recordExchange } from '@modules/ai/conversation.memory.js'
import { orchestrateFinancialQuery } from '@modules/query/query.orchestrator.js'
import { CONFIDENCE } from '@config/constants.js'
import { routeMessage } from './message.router.service.js'
import { handleCommand } from './command/handlers/index.js'

// =============================================================================
// FinIA — Message Processor
// =============================================================================
//
// Orquestra o pipeline completo de uma mensagem recebida (consumido pelo
// MessageProcessorWorker):
//
//   1. Resolve/cria o usuário pelo telefone.
//   2. Sem texto (mídia) → orienta o usuário.
//   3. Comando (oi/ajuda/dashboard) → responde com o handler.
//   4. Texto livre → parser determinístico:
//        auto_save / needs_review → cria a transação e confirma
//        ai_fallback (ou sem valor) → pede para reformular (IA entra no Sprint 2)
//   5. Registra um MessageLog de auditoria (best-effort).
//
// =============================================================================

export async function processIncomingMessage(msg: NormalizedMessage): Promise<void> {
  const user = await findOrCreateByPhone(msg.from)
  const text = msg.text?.trim() ?? ''

  // 2. Mídia sem texto
  if (!text) {
    await notificationService.sendText(msg.from, mediaUnsupportedTemplate(), user.id)
    await recordMessageLog(msg, user.id, null)
    return
  }

  // 3. Comando
  const routed = routeMessage(text)
  if (routed.kind === 'command') {
    const reply = await handleCommand(routed.command, user)
    await notificationService.sendText(msg.from, reply, user.id)
    await recordMessageLog(msg, user.id, null)
    return
  }

  // 3.5. Consulta financeira ("quanto gastei esse mês", "saldo", "resumo")
  if (routed.kind === 'query') {
    const reply = await orchestrateFinancialQuery(text, user)
    await notificationService.sendText(msg.from, reply, user.id)
    await recordExchange(user.id, text, reply)
    await recordMessageLog(msg, user.id, null)
    return
  }

  // 4. Texto livre → parser determinístico
  const { decision, parsed } = await orchestrateParse(text, {
    userId: user.id,
    timezone: user.timezone,
  })

  if (decision === 'ai_fallback' || parsed.amount === null) {
    // Sprint 2: o parser determinístico não resolveu → tenta o Claude.
    const aiResult = await parseWithAI(text, { timezone: user.timezone })

    if (aiResult) {
      const aiTransaction = await createTransaction({
        userId: user.id,
        type: aiResult.type,
        amount: aiResult.amount,
        date: aiResult.date,
        description: aiResult.description,
        merchantName: aiResult.merchantName,
        originalText: text,
        categoryId: aiResult.categoryId,
        currency: user.currency,
        parseMethod: 'AI',
        parseConfidence: aiResult.confidence,
        needsReview: aiResult.confidence < CONFIDENCE.AUTO_SAVE,
      })

      const aiReply = transactionConfirmationTemplate({
        type: aiTransaction.type,
        amount: aiResult.amount,
        currency: user.currency,
        merchantName: aiResult.merchantName,
        date: aiTransaction.date,
        timezone: user.timezone,
        needsReview: aiResult.confidence < CONFIDENCE.AUTO_SAVE,
      })
      await notificationService.sendText(msg.from, aiReply, user.id)
      await recordExchange(user.id, text, aiReply)
      await recordMessageLog(msg, user.id, aiTransaction.id)
      return
    }

    // IA desativada ou também não entendeu → pede reformulação.
    await notificationService.sendText(msg.from, notUnderstoodTemplate(text), user.id)
    await recordMessageLog(msg, user.id, null)
    return
  }

  const transaction = await createTransaction({
    userId: user.id,
    type: parsed.type,
    amount: parsed.amount,
    date: parsed.date,
    description: parsed.description,
    merchantName: parsed.merchantName,
    originalText: text,
    categoryId: parsed.categoryId,
    currency: user.currency,
    parseMethod: 'DETERMINISTIC',
    parseConfidence: parsed.confidence,
    needsReview: decision === 'needs_review',
  })

  const reply = transactionConfirmationTemplate({
    type: transaction.type,
    amount: parsed.amount,
    currency: user.currency,
    merchantName: parsed.merchantName,
    date: transaction.date,
    timezone: user.timezone,
    needsReview: decision === 'needs_review',
  })
  await notificationService.sendText(msg.from, reply, user.id)
  await recordExchange(user.id, text, reply)
  await recordMessageLog(msg, user.id, transaction.id)
}

/**
 * Grava o MessageLog de auditoria. Best-effort: uma falha aqui (ex: duplicata
 * por retry do job) é logada como aviso e NÃO derruba o processamento — a
 * idempotência primária já foi garantida pelo Redis no webhook.
 */
async function recordMessageLog(
  msg: NormalizedMessage,
  userId: string,
  transactionId: string | null,
): Promise<void> {
  try {
    await prisma.messageLog.create({
      data: {
        userId,
        provider: msg.provider,
        providerMessageId: msg.providerMessageId,
        fromPhone: msg.from,
        messageType: msg.type,
        text: msg.text ?? null,
        mediaUrl: msg.mediaUrl ?? null,
        processed: true,
        transactionId,
        providerTimestamp: msg.timestamp,
      },
    })
  } catch (err) {
    logger.warn(
      { err, messageId: msg.providerMessageId },
      'MessageLog não registrado (auditoria)',
    )
  }
}
