import { getAnthropicClient, isAiConfigured } from '@modules/ai/anthropic.client.js'
import { AI_MODELS } from '@config/constants.js'
import { logger } from '@config/logger.js'
import type { InsightInput } from './insight.data.js'
import type { GeneratedInsight } from './insight.rules.js'

// =============================================================================
// FinIA — Insights narrativos (Sonnet)
// =============================================================================
//
// §7.3: 1x/semana (cron), o Sonnet recebe os dados AGREGADOS + histórico de
// 3 meses e devolve 2-4 insights narrativos — padrões que as regras fixas não
// enxergam. Saída estruturada via tool use; entrada só agregados (nunca dados
// crus), o que limita custo e alucinação.
//
// Modelo: AI_MODELS.INSIGHTS (claude-sonnet-4-6) — decisão §4: modelo mais
// capaz para insights/relatórios, o barato (Haiku) para parsing/queries.
//
// =============================================================================

const MIN_TRANSACTIONS = 5 // sem volume não há padrão para narrar

const SYSTEM_PROMPT = [
  'Você é o motor de insights do FinIA, assistente financeiro brasileiro.',
  'Receberá dados financeiros AGREGADOS de um usuário (mês atual, anterior e',
  'histórico). Gere de 2 a 4 insights narrativos ÚTEIS e específicos.',
  '',
  'Regras:',
  '- Baseie-se APENAS nos números fornecidos; nunca invente valores.',
  '- Cada insight: title (máx 80 chars, direto) e body (máx 300 chars,',
  '  português brasileiro, tom amigável, com os números relevantes).',
  '- Procure padrões: tendências ao longo dos meses, mudanças de comportamento,',
  '  concentrações, oportunidades práticas de economia.',
  '- NÃO repita o óbvio que uma regra fixa pegaria (ex: "categoria X subiu 25%").',
  '- Sem conselhos de investimento.',
  'Sempre responda chamando a ferramenta record_insights.',
].join('\n')

export async function generateNarrativeInsights(
  input: InsightInput,
): Promise<GeneratedInsight[]> {
  if (!isAiConfigured()) return []
  if (input.transactionCount < MIN_TRANSACTIONS) return []

  const client = getAnthropicClient()

  try {
    const response = await client.messages.create({
      model: AI_MODELS.INSIGHTS,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'record_insights',
          description: 'Registra os insights narrativos gerados.',
          input_schema: {
            type: 'object',
            properties: {
              insights: {
                type: 'array',
                minItems: 2,
                maxItems: 4,
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', maxLength: 80 },
                    body: { type: 'string', maxLength: 400 },
                  },
                  required: ['title', 'body'],
                },
              },
            },
            required: ['insights'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'record_insights' },
      messages: [
        {
          role: 'user',
          content: `Dados agregados do usuário (JSON):\n${JSON.stringify(input)}`,
        },
      ],
    })

    const block = response.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return []

    const raw = (block.input as { insights?: Array<{ title?: unknown; body?: unknown }> }).insights
    if (!Array.isArray(raw)) return []

    return raw
      .filter((i) => typeof i.title === 'string' && typeof i.body === 'string')
      .slice(0, 4)
      .map((i) => ({
        type: 'GENERIC' as const,
        title: (i.title as string).slice(0, 200),
        body: (i.body as string).slice(0, 1000),
        data: { aiModel: AI_MODELS.INSIGHTS },
      }))
  } catch (error) {
    logger.error({ err: error }, 'Insight narrativo: falha na chamada ao Claude')
    return []
  }
}
