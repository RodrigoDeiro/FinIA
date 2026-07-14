import type { FastifyInstance } from 'fastify'
import { env, assertWhatsAppEnv } from '@config/env.js'
import { logger } from '@config/logger.js'
import type { IWhatsAppProvider } from './providers/whatsapp.provider.interface.js'
import { EvolutionProvider } from './providers/evolution/evolution.provider.js'
import { whatsappRoutes } from './whatsapp.routes.js'

// =============================================================================
// FinIA — Módulo WhatsApp
// =============================================================================
//
// Responsabilidades ao inicializar:
//   1. Valida as variáveis EVOLUTION_* (assertWhatsAppEnv) — fast fail aqui,
//      NÃO no boot global (anti-padrão #4). Após o assert, os campos do env
//      deixam de ser `string | undefined` e viram `string`.
//   2. Constrói o provider concreto conforme WHATSAPP_PROVIDER.
//   3. Registra as rotas do webhook.
//
// O provider fica acessível via getWhatsAppProvider() para o NotificationWorker
// (envio de mensagens) sem precisar de injeção pelo Fastify.
//
// =============================================================================

let provider: IWhatsAppProvider | null = null

/**
 * Retorna o provider de WhatsApp inicializado.
 * Lança se chamado antes de registerWhatsAppModule (erro de ordenação no boot).
 */
export function getWhatsAppProvider(): IWhatsAppProvider {
  if (!provider) {
    throw new Error(
      'WhatsApp provider não inicializado. registerWhatsAppModule() deve ' +
        'rodar no boot antes de qualquer envio de mensagem.',
    )
  }
  return provider
}

/** Constrói o provider concreto a partir das variáveis de ambiente. */
function buildProvider(): IWhatsAppProvider {
  assertWhatsAppEnv(env) // após isto, EVOLUTION_* são `string`

  if (env.WHATSAPP_PROVIDER === 'meta') {
    // Meta Cloud API entra em um Sprint futuro (decisão aprovada).
    throw new Error('WHATSAPP_PROVIDER=meta ainda não implementado (Sprint futuro)')
  }

  return new EvolutionProvider({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instance: env.EVOLUTION_INSTANCE_NAME,
    webhookSecret: env.EVOLUTION_WEBHOOK_SECRET,
  })
}

/**
 * Inicializa o módulo e registra as rotas no app Fastify.
 * Chamado a partir de app.ts no boot.
 */
export async function registerWhatsAppModule(app: FastifyInstance): Promise<void> {
  provider = buildProvider()
  await app.register(whatsappRoutes, { provider })
  logger.info({ provider: provider.name }, 'Módulo WhatsApp registrado')
}
