import type { FastifyInstance } from 'fastify'
import { env } from '@config/env.js'
import { logger } from '@config/logger.js'
import { prisma } from '@database/prisma.js'
import { cacheService } from '@cache/cache.service.js'
import { processMessageForUser } from '@modules/message/message.processor.js'
import { consumeTelegramLinkCode } from './telegram.link.service.js'
import { sendTelegramMessage } from './telegram.service.js'

// =============================================================================
// FinIA — Webhook do Telegram (POST /webhook/telegram)
// =============================================================================
//
// Autenticação: header X-Telegram-Bot-Api-Secret-Token (definido no setWebhook).
// Fluxo:
//   /start <código> → vincula o chat à conta (consome o código do painel)
//   /start          → orienta a conectar pelo painel
//   texto           → precisa estar vinculado → processa (parser + IA) e responde
//
// =============================================================================

interface TelegramUpdate {
  update_id?: number
  message?: {
    message_id?: number
    chat?: { id?: number }
    from?: { first_name?: string }
    text?: string
  }
}

const IDEMPOTENCY_TTL = 60 * 60 * 24 // 24h

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message
  const chatId = msg?.chat?.id
  const text = msg?.text?.trim()
  if (chatId === undefined || !text) return

  // Idempotência: descarta reentregas do mesmo update
  if (update.update_id !== undefined) {
    const first = await cacheService.markIfFirst(`tgupd:${update.update_id}`, IDEMPOTENCY_TTL)
    if (!first) return
  }

  const chat = String(chatId)

  // ─── /start [código] ─────────────────────────────────────────────────────
  if (text.startsWith('/start')) {
    const code = text.split(/\s+/)[1]
    if (code) {
      const userId = await consumeTelegramLinkCode(code)
      if (!userId) {
        await sendTelegramMessage(chat, 'Link de conexão inválido ou expirado. Gere um novo no painel: Configurações → Conectar Telegram.')
        return
      }
      // Libera o chatId de qualquer conta anterior antes de vincular
      await prisma.user.updateMany({ where: { telegramChatId: chat }, data: { telegramChatId: null } })
      await prisma.user.update({ where: { id: userId }, data: { telegramChatId: chat } })
      await sendTelegramMessage(chat, '✅ Telegram conectado à sua conta FinIA! Agora é só mandar seus gastos, ex: "mercado 89,90".')
      return
    }
    await sendTelegramMessage(chat, 'Olá! Para usar o FinIA, conecte sua conta: no painel, vá em Configurações → Conectar Telegram e toque no link.')
    return
  }

  // ─── Mensagem normal → exige vínculo ──────────────────────────────────────
  const user = await prisma.user.findFirst({ where: { telegramChatId: chat, deletedAt: null } })
  if (!user) {
    await sendTelegramMessage(chat, 'Sua conta ainda não está conectada. No painel: Configurações → Conectar Telegram.')
    return
  }

  await processMessageForUser(user, text, (message) => sendTelegramMessage(chat, message))
}

export async function telegramRoutes(app: FastifyInstance): Promise<void> {
  app.post('/webhook/telegram', async (request, reply) => {
    const secret = request.headers['x-telegram-bot-api-secret-token']
    if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return reply.code(401).send({ error: 'invalid_secret' })
    }
    try {
      await handleUpdate(request.body as TelegramUpdate)
    } catch (err) {
      logger.error({ err }, 'Telegram: erro ao processar update')
    }
    return reply.code(200).send({ ok: true })
  })
}
