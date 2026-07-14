import { getAnthropicClient } from './anthropic.client.js'
import { AI_MODELS } from '@config/constants.js'
import { logger } from '@config/logger.js'
import type { FinancialSnapshot } from './context.builder.js'
import type { ConversationExchange } from './conversation.memory.js'

// =============================================================================
// FinIA — AI Query Responder
// =============================================================================
//
// Responde consultas financeiras COMPLEXAS que o DeterministicQueryParser não
// mapeou (ex: "estou gastando demais?", "compara esse mês com o passado").
//
// O Claude NÃO consulta o banco: recebe um snapshot agregado (Camada 2) e o
// histórico curto da conversa (Camada 1) e responde apenas sobre esses dados.
// Isso limita alucinação e mantém o custo baixo (Haiku + prompt compacto).
//
// =============================================================================

const SYSTEM_PROMPT = [
  'Você é o FinIA, assistente financeiro pessoal brasileiro no WhatsApp.',
  'Responda a pergunta do usuário usando APENAS os dados fornecidos no JSON.',
  'Regras:',
  '- Responda em português brasileiro, tom amigável e direto, formato WhatsApp',
  '  (use *negrito* para valores; no máximo ~5 linhas).',
  '- Valores em reais: R$ 1.234,56.',
  '- NUNCA invente números que não estejam nos dados. Se os dados não bastam',
  '  para responder, diga o que você consegue responder com o que tem.',
  '- Não dê conselhos de investimento; observações práticas de orçamento são ok.',
].join('\n')

export async function answerQueryWithAI(
  question: string,
  snapshot: FinancialSnapshot,
  conversation: ConversationExchange[],
): Promise<string | null> {
  const client = getAnthropicClient()

  const history =
    conversation.length > 0
      ? conversation.map((e) => `Usuário: ${e.user}\nFinIA: ${e.assistant}`).join('\n---\n')
      : '(sem histórico)'

  try {
    const response = await client.messages.create({
      model: AI_MODELS.PARSER,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content:
            `Dados financeiros do usuário:\n${JSON.stringify(snapshot)}\n\n` +
            `Conversa recente:\n${history}\n\n` +
            `Pergunta do usuário: ${question}`,
        },
      ],
    })

    const block = response.content.find((b) => b.type === 'text')
    const text = block && 'text' in block ? block.text.trim() : ''
    return text.length > 0 ? text : null
  } catch (error) {
    logger.error({ err: error }, 'AI: falha ao responder consulta via Claude')
    return null
  }
}
