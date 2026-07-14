import { env, assertAiEnv } from '@config/env.js'
import { logger } from '@config/logger.js'
import { isAiConfigured } from './anthropic.client.js'
import { AI_MODELS } from '@config/constants.js'

// =============================================================================
// FinIA — Módulo AI
// =============================================================================
//
// Inicialização no boot. A IA é OPCIONAL: se ANTHROPIC_API_KEY não estiver
// configurada, o módulo apenas registra que está desativado e o pipeline segue
// degradando graciosamente (mensagens ambíguas recebem "não entendi").
//
// Quando há chave, assertAiEnv valida o formato (sk-ant-...) — fast fail aqui,
// não no boot global (anti-padrão #4).
//
// =============================================================================

export function initAiModule(): void {
  if (!isAiConfigured()) {
    logger.warn(
      'Módulo AI desativado: ANTHROPIC_API_KEY ausente. ' +
        'Mensagens ambíguas (confiança < 0.65) receberão resposta de fallback.',
    )
    return
  }

  assertAiEnv(env) // valida o formato sk-ant-
  logger.info({ parser: AI_MODELS.PARSER }, 'Módulo AI ativado')
}
