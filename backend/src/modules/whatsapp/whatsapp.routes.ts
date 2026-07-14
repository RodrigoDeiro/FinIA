import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { IWhatsAppProvider } from './providers/whatsapp.provider.interface.js'
import { createWhatsAppController } from './whatsapp.controller.js'

// =============================================================================
// FinIA — Rotas do WhatsApp
// =============================================================================
//
// Registra POST /webhook/evolution.
//
// Content-type parser customizado: precisamos do corpo BRUTO (string original)
// para validar a assinatura HMAC — recalcular o HMAC sobre um JSON re-serializado
// não bateria com os bytes que o provider assinou. O parser guarda o raw em
// request.rawBody e ainda entrega o objeto parseado em request.body.
//
// Parsers de content-type no Fastify são encapsulados ao escopo do plugin,
// então este só afeta as rotas deste módulo.
//
// =============================================================================

interface WhatsAppRoutesOptions {
  provider: IWhatsAppProvider
}

export async function whatsappRoutes(
  app: FastifyInstance,
  opts: WhatsAppRoutesOptions,
): Promise<void> {
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req: FastifyRequest, body: string | Buffer, done) => {
      const raw = typeof body === 'string' ? body : body.toString('utf8')
      req.rawBody = raw
      try {
        done(null, raw.length > 0 ? JSON.parse(raw) : {})
      } catch (err) {
        done(err as Error, undefined)
      }
    },
  )

  const controller = createWhatsAppController(opts.provider)

  app.post('/webhook/evolution', controller.handleWebhook)
}
