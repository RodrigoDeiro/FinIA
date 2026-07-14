import { TransactionType } from '@prisma/client'
import type { ExtractedIntent } from '../types/parse-result.type.js'

// =============================================================================
// FinIA — Intent Extractor
// =============================================================================
//
// Determina o tipo de transação por palavras-chave. A ordem importa: tipos
// específicos (INCOME, INVESTMENT, DEBT, TRANSFER) são checados ANTES de
// EXPENSE, porque verbos genéricos ("comprei") também aparecem em frases de
// investimento ("comprei bitcoin"). EXPENSE é o default quando nada casa
// (a maioria das mensagens é de gasto).
//
// Comparação feita sobre o texto normalizado (minúsculas, sem acento).
//
// =============================================================================

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

// Listas em ordem de prioridade. Cada item é uma palavra/expressão-chave já
// normalizada (sem acento). Usadas com fronteira de palavra.
const KEYWORDS: Array<{ type: TransactionType; words: string[] }> = [
  {
    type: TransactionType.INCOME,
    words: [
      'recebi', 'salario', 'ganhei', 'recebimento', 'rendimento', 'freela',
      'freelance', 'reembolso', 'caiu', 'entrou', 'deposito', 'depositei',
      'vendi', 'vendido', 'pix recebido',
    ],
  },
  {
    type: TransactionType.INVESTMENT,
    words: [
      'investi', 'apliquei', 'aporte', 'aportei', 'investimento',
      'acoes', 'acao', 'bitcoin', 'btc', 'cripto', 'tesouro', 'cdb',
      'fii', 'fundo', 'dividendo',
    ],
  },
  {
    type: TransactionType.DEBT,
    words: [
      'divida', 'devo', 'emprestimo', 'emprestei', 'financiamento',
      'parcela', 'parcelei', 'prestacao',
    ],
  },
  {
    type: TransactionType.TRANSFER,
    words: ['transferi', 'transferencia', 'ted ', 'doc '],
  },
  {
    type: TransactionType.EXPENSE,
    words: [
      'gastei', 'paguei', 'comprei', 'gasto', 'compra', 'paga', 'pagamento',
      'pix', 'debito', 'credito',
    ],
  },
]

export function extractIntent(text: string): ExtractedIntent {
  const normalized = normalize(text)

  for (const group of KEYWORDS) {
    for (const word of group.words) {
      // Fronteira de palavra para evitar casar "pixel" em "pix", etc.
      const re = new RegExp(`\\b${word.trim()}\\b`)
      if (re.test(normalized)) {
        return { type: group.type, matchedKeyword: word.trim(), explicit: true }
      }
    }
  }

  // Nenhuma palavra-chave: assume gasto (default), sem marca de explícito.
  return { type: TransactionType.EXPENSE, matchedKeyword: null, explicit: false }
}
