import type { DetectedMessage } from '../types/message.types.js'

// =============================================================================
// FinIA — Command Detector
// =============================================================================
//
// Distingue comandos (saudação, ajuda, dashboard) de texto livre (provável
// transação). A detecção é conservadora: na dúvida, trata como texto e deixa
// o parser decidir — é menos custoso parsear um "oi" do que ignorar um gasto.
//
// Regras:
//   - saudação: a mensagem é CURTA e contém só uma saudação (sem números).
//   - ajuda / dashboard: contêm a palavra-chave correspondente.
//
// =============================================================================

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

const GREETINGS = [
  'oi', 'ola', 'eai', 'e ai', 'opa', 'bom dia', 'boa tarde', 'boa noite',
  'hello', 'hi', 'menu', 'comecar', 'start',
]

const HELP_WORDS = ['ajuda', 'help', 'socorro', 'duvida', 'como funciona', 'como usar']

// 'relatorio(s)' saiu daqui: agora é tratado como consulta (SUMMARY) pelo
// query.detector — responder com um resumo real é melhor que "em breve".
const DASHBOARD_WORDS = ['dashboard', 'painel', 'site', 'web']

// "resumo" / "meu mês" → visão consolidada do mês (renda, fixas, cartão, sobra).
const SUMMARY_WORDS = ['resumo', 'balanco', 'meu mes', 'fechamento do mes', 'como esta o mes']

const hasDigit = (s: string): boolean => /\d/.test(s)

export function detectCommand(text: string): DetectedMessage {
  const normalized = normalize(text)

  // Ajuda tem prioridade — palavra explícita de pedido de ajuda.
  if (HELP_WORDS.some((w) => normalized.includes(w))) {
    return { kind: 'command', command: 'help' }
  }

  if (SUMMARY_WORDS.some((w) => normalized.includes(w))) {
    return { kind: 'command', command: 'summary' }
  }

  if (DASHBOARD_WORDS.some((w) => normalized.includes(w))) {
    return { kind: 'command', command: 'dashboard' }
  }

  // Saudação: mensagem curta, sem dígitos, que é exatamente/quase uma saudação.
  // Mensagens com números nunca são saudação (ex: "oi, gastei 50" → texto).
  if (!hasDigit(normalized) && normalized.length <= 20) {
    if (GREETINGS.some((g) => normalized === g || normalized.startsWith(`${g} `) || normalized === `${g}!`)) {
      return { kind: 'command', command: 'greeting' }
    }
  }

  return { kind: 'text' }
}
