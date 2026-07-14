import { TransactionType } from '@prisma/client'
import { getAnthropicClient } from './anthropic.client.js'
import { buildTransactionSystemPrompt } from './prompt.factory.js'
import { AI_MODELS } from '@config/constants.js'
import { logger } from '@config/logger.js'
import type { AIExtractedTransaction } from './types/ai.types.js'

// =============================================================================
// FinIA — AI Transaction Parser
// =============================================================================
//
// Usa o Claude (Haiku) para extrair uma transação de uma mensagem que o parser
// determinístico não resolveu (confiança < 0.65).
//
// Por que tool use (e não texto livre): o `input` de um tool_use já chega como
// objeto estruturado e validado pelo schema — sem JSON.parse frágil. Forçamos
// a chamada com tool_choice para garantir saída no formato esperado.
//
// =============================================================================

const TOOL_NAME = 'record_transaction'

const VALID_TYPES = new Set<string>(Object.values(TransactionType))

/**
 * Extrai uma transação via Claude. Retorna null em qualquer falha (erro de API,
 * recusa, ausência de valor) — o orquestrador decide o fallback.
 */
export async function extractTransactionWithAI(
  text: string,
  categorySlugs: string[],
): Promise<AIExtractedTransaction | null> {
  const client = getAnthropicClient()

  try {
    const response = await client.messages.create({
      model: AI_MODELS.PARSER,
      max_tokens: 512,
      system: buildTransactionSystemPrompt(categorySlugs),
      tools: [
        {
          name: TOOL_NAME,
          description: 'Registra a transação financeira extraída da mensagem do usuário.',
          input_schema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: Object.values(TransactionType),
                description: 'Tipo da transação',
              },
              amount: { type: 'number', description: 'Valor positivo em reais' },
              merchantName: {
                type: ['string', 'null'],
                description: 'Nome do estabelecimento/origem, ou null',
              },
              categorySlug: {
                type: ['string', 'null'],
                description: 'Slug da categoria (deve ser um dos válidos) ou null',
              },
              description: { type: ['string', 'null'] },
              confidence: { type: 'number', description: 'Confiança 0–1' },
            },
            required: ['type', 'amount', 'confidence'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: text }],
    })

    const block = response.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return null

    const input = block.input as Record<string, unknown>

    // Validação defensiva: a IA pode devolver formas inesperadas.
    const amount = typeof input.amount === 'number' ? input.amount : null
    if (amount === null || !(amount > 0)) return null

    const rawType = typeof input.type === 'string' ? input.type : 'EXPENSE'
    const type = (VALID_TYPES.has(rawType) ? rawType : 'EXPENSE') as TransactionType

    return {
      type,
      amount,
      merchantName: typeof input.merchantName === 'string' ? input.merchantName : null,
      categorySlug: typeof input.categorySlug === 'string' ? input.categorySlug : null,
      description: typeof input.description === 'string' ? input.description : null,
      confidence: typeof input.confidence === 'number' ? input.confidence : 0.5,
    }
  } catch (error) {
    logger.error({ err: error }, 'AI: falha ao extrair transação via Claude')
    return null
  }
}
