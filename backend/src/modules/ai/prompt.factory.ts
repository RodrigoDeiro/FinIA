// =============================================================================
// FinIA — Prompt Factory
// =============================================================================
//
// Monta os prompts enviados ao Claude. Centralizado para versionar o tom e as
// regras de extração em um único lugar.
//
// =============================================================================

/**
 * System prompt para extração de transação de uma mensagem ambígua.
 * Recebe a lista de slugs de categoria válidos para restringir a saída.
 */
export function buildTransactionSystemPrompt(categorySlugs: string[]): string {
  return [
    'Você é o motor de interpretação do FinIA, um assistente financeiro brasileiro.',
    'Sua tarefa: extrair os dados de UMA transação financeira de uma mensagem em',
    'português brasileiro, informal, escrita por uma pessoa comum no WhatsApp.',
    '',
    'Regras:',
    '- amount: SEMPRE positivo, em reais, como número (ex: 89.9). O sinal é dado pelo type.',
    '- type: EXPENSE (gasto), INCOME (receita/entrada), INVESTMENT (investimento),',
    '  TRANSFER (transferência), DEBT (dívida/parcela). Na dúvida entre gasto e outro, use EXPENSE.',
    `- categorySlug: escolha EXATAMENTE um destes, ou null se nenhum se aplica: ${categorySlugs.join(', ')}.`,
    '- merchantName: nome do estabelecimento/origem, se houver (ex: "Mercado Extra"); senão null.',
    '- confidence: 0 a 1, o quanto você confia que a mensagem realmente descreve uma transação.',
    '  Se a mensagem for uma saudação, dúvida, ou claramente NÃO for uma transação, use confidence < 0.3.',
    '',
    'Sempre responda chamando a ferramenta record_transaction. Não escreva texto livre.',
  ].join('\n')
}
