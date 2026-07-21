import type { FastifyInstance } from 'fastify'
import { env } from '@config/env.js'
import { logger } from '@config/logger.js'
import { telegramRoutes } from './telegram.routes.js'
import { setTelegramWebhook } from './telegram.service.js'

// =============================================================================
// FinIA — Módulo Telegram
// =============================================================================
//
// Ativado apenas quando TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET existem.
// Sem eles, o app sobe normalmente sem Telegram (no-op).
//
// No boot, aponta o webhook do bot para APP_URL/webhook/telegram (idempotente).
//
// =============================================================================

export async function registerTelegramModule(app: FastifyInstance): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    logger.info('Telegram: token/secret ausentes — módulo desativado')
    return
  }

  await app.register(telegramRoutes)

  if (env.APP_URL) {
    const url = `${env.APP_URL}/webhook/telegram`
    const ok = await setTelegramWebhook(url, env.TELEGRAM_WEBHOOK_SECRET)
    logger.info({ url, ok }, 'Telegram: webhook configurado no boot')
  } else {
    logger.warn('Telegram: APP_URL ausente — webhook não configurado automaticamente')
  }

  logger.info('Módulo Telegram registrado (/webhook/telegram)')
}
