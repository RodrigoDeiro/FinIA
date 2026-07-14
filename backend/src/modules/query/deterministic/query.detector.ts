import { normalizeText } from '@shared/utils/text.util.js'
import type { QueryMetric } from '../types/query.types.js'

// =============================================================================
// FinIA — Query Detector
// =============================================================================
//
// Duas responsabilidades:
//
//   isFinancialQuery(text)  → esta mensagem é uma PERGUNTA financeira?
//   detectQueryMetric(text) → qual métrica ela pede? (null = consulta complexa
//                             que o determinístico não mapeia → vai para a IA)
//
// A detecção é conservadora para NÃO sequestrar transações:
//   "gastei 50 no mercado"      → sem interrogativa, sem '?' → transação
//   "quanto gastei esse mês?"   → interrogativa + termo financeiro → consulta
//   "saldo" / "resumo"          → palavras que sozinhas já são consultas
//
// =============================================================================

// Palavras que sozinhas já constituem uma consulta
const STANDALONE_RE = /\b(saldo|resumo|extrato|balanco|relatorio|relatorios)\b/

// Interrogativas comuns em consultas financeiras
const INTERROGATIVE_RE = /\b(quanto|quantos|quantas|qual|quais|onde|como)\b/

// Termos do domínio financeiro (radicais, texto já normalizado)
const FINANCIAL_RE =
  /\b(gast\w*|receb\w*|ganhei|ganho|entrou|saiu|sobrou|saldo|resumo|extrato|balanco|financ\w*|receitas?|despes\w*|grana|dinheiro|invest\w*|transac\w*|economi\w*)\b/

/** true se a mensagem é uma pergunta/consulta financeira. */
export function isFinancialQuery(text: string): boolean {
  const t = normalizeText(text)

  if (STANDALONE_RE.test(t)) return true

  const asksSomething = INTERROGATIVE_RE.test(t) || t.includes('?')
  return asksSomething && FINANCIAL_RE.test(t)
}

/**
 * Mapeia a consulta para uma métrica conhecida. A ordem importa: padrões mais
 * específicos ("onde gastei mais") antes dos genéricos ("gastei").
 * Retorna null quando a pergunta é financeira mas não mapeável → IA responde.
 */
export function detectQueryMetric(text: string): QueryMetric | null {
  const t = normalizeText(text)

  // "onde gastei mais", "maiores gastos", "com o que gastei", "top gastos"
  if (
    (/\b(onde|com o que|no que|em que)\b/.test(t) && /\bgast/.test(t)) ||
    (/\b(maiores|principais|top)\b/.test(t) && /\bgast/.test(t))
  ) {
    return 'TOP_CATEGORIES'
  }

  if (/\b(resumo|extrato|relatorio|relatorios|financas)\b/.test(t)) return 'SUMMARY'

  if (/\b(saldo|balanco|sobrou|quanto tenho)\b/.test(t)) return 'BALANCE'

  if (/\b(gastei|gasto|gastos|gastamos|saiu|despesas?)\b/.test(t)) return 'EXPENSE_SUM'

  if (/\b(recebi|ganhei|entrou|receitas?|rendimentos?)\b/.test(t)) return 'INCOME_SUM'

  return null
}
