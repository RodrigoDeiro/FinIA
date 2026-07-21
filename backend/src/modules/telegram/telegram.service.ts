import { env } from '@config/env.js'
import { logger } from '@config/logger.js'

// =============================================================================
// FinIA — Telegram Bot API (envio + configuração de webhook)
// =============================================================================
//
// API oficial e gratuita: https://core.telegram.org/bots/api
// Não precisa de QR nem sessão — só o token do bot (via @BotFather).
//
// =============================================================================

function apiUrl(method: string): string {
  return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`
}

/** Envia uma mensagem de texto para um chat. Best-effort (loga falhas). */
export async function sendTelegramMessage(chatId: string | number, text: string): Promise<void> {
  try {
    const res = await fetch(apiUrl('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    if (!res.ok) {
      logger.error({ status: res.status, body: await res.text() }, 'Telegram: sendMessage falhou')
    }
  } catch (err) {
    logger.error({ err }, 'Telegram: erro ao enviar mensagem')
  }
}

/** Aponta o webhook do bot para a URL do app (com secret token). */
export async function setTelegramWebhook(url: string, secret: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('setWebhook'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, secret_token: secret, allowed_updates: ['message'] }),
    })
    const json = (await res.json()) as { ok: boolean; description?: string }
    if (!json.ok) logger.error({ desc: json.description }, 'Telegram: setWebhook falhou')
    return json.ok
  } catch (err) {
    logger.error({ err }, 'Telegram: erro ao configurar webhook')
    return false
  }
}
