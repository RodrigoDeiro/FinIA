import type { TransactionType } from '@prisma/client'

// =============================================================================
// FinIA — Tipos do Parse
// =============================================================================

/** Valor monetário extraído da mensagem. */
export interface ExtractedAmount {
  /** Valor numérico positivo, arredondado a 2 casas */
  value: number
  /** Trecho original que originou o valor (ex: 'R$ 89,90') */
  raw: string
}

/** Intenção (tipo de transação) extraída por palavras-chave. */
export interface ExtractedIntent {
  type: TransactionType
  /** Palavra-chave que casou (null = nenhuma; caiu no default EXPENSE) */
  matchedKeyword: string | null
  /** true se uma palavra-chave explícita determinou o tipo */
  explicit: boolean
}

/** Data extraída (relativa ou explícita). */
export interface ExtractedDate {
  /** Data em UTC pronta para gravar */
  date: Date
  /** Trecho que originou a data (ex: 'ontem', '24/06'); null se assumiu hoje */
  raw: string | null
  /** true se uma expressão de data explícita foi encontrada */
  explicit: boolean
}

/** Estabelecimento reconhecido na base de merchants. */
export interface ExtractedMerchant {
  merchantId: string
  name: string
  categoryId: string
  defaultType: TransactionType
  /** Texto que casou (slug, nome ou alias) */
  matched: string
  /** true se veio dos merchants do usuário (vs globais) */
  fromUser: boolean
}

/** Componentes booleanos usados pelo cálculo de confiança. */
export interface ConfidenceComponents {
  hasAmount: boolean
  hasType: boolean
  hasMerchant: boolean
  hasContext: boolean
}

/** Resultado completo do parser determinístico. */
export interface DeterministicParseResult {
  /** Valor (null se não foi possível extrair um valor plausível) */
  amount: number | null
  type: TransactionType
  date: Date
  /** Nome do estabelecimento (do merchant reconhecido) — null se desconhecido */
  merchantName: string | null
  /** Id do merchant reconhecido — null se desconhecido */
  merchantId: string | null
  /** Categoria do merchant — null se desconhecido (resolve fallback no service) */
  categoryId: string | null
  /** Texto original (descrição da transação) */
  description: string
  /** Score 0.00–1.00 */
  confidence: number
  components: ConfidenceComponents
}

/** Decisão do orquestrador sobre o destino da mensagem. */
export type ParseDecision = 'auto_save' | 'needs_review' | 'ai_fallback'

export interface ParseOrchestratorResult {
  decision: ParseDecision
  parsed: DeterministicParseResult
}
