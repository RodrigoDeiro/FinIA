import type { NormalizedMessage } from '@modules/whatsapp/types/normalized-message.type.js'

// =============================================================================
// FinIA — Job: message.incoming
// =============================================================================
//
// Payload enfileirado pelo webhook após validar e normalizar uma mensagem.
// O MessageProcessorWorker consome este job e roda o pipeline completo
// (usuário → roteamento → parse → transação → notificação).
//
// =============================================================================

/** Nome lógico do job dentro da fila message.incoming */
export const MESSAGE_JOB_NAME = 'process-incoming'

export interface MessageJobData {
  /** Mensagem já normalizada para o formato interno, pronta para processar */
  normalized: NormalizedMessage
}
