// =============================================================================
// FinIA — Tipos da API (espelham os DTOs do backend)
// =============================================================================

export type TransactionType = 'EXPENSE' | 'INCOME' | 'INVESTMENT' | 'TRANSFER' | 'DEBT'
export type ParseMethod = 'DETERMINISTIC' | 'AI' | 'HYBRID' | 'MANUAL'
export type BudgetPeriod = 'MONTHLY' | 'WEEKLY' | 'YEARLY'
export type GoalStatus = 'ACTIVE' | 'ACHIEVED' | 'ABANDONED' | 'PAUSED'
export type CategoryOrigin = 'SYSTEM' | 'USER'

export interface User {
  id: string
  name: string | null
  phoneNumber: string | null
  email: string | null
  timezone: string
  currency: string
  language: string
  createdAt: string
}

export interface Account {
  id: string
  name: string
  type: string
  institution: string | null
  isDefault: boolean
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  color: string | null
  origin: CategoryOrigin
  applicableTo: TransactionType | null
}

export interface CreditPurchase {
  id: string
  description: string
  card: string | null
  totalAmount: number
  installments: number
  firstDueDate: string
  nextDueDate: string | null
  installmentAmount: number
  paidCount: number
  remainingCount: number
  paidAmount: number
  remainingAmount: number
  progress: number
}

export interface CreditSummary {
  monthlyCommitment: number
  totalRemaining: number
  activeCount: number
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  currency: string
  date: string
  description: string | null
  merchantName: string | null
  categoryId: string
  categoryName: string | null
  accountId: string
  needsReview: boolean
  parseMethod: ParseMethod
  parseConfidence: number | null
  createdAt: string
}

export interface TransactionPage {
  items: Transaction[]
  page: number
  pageSize: number
  total: number
}

export interface Budget {
  id: string
  categoryId: string
  categoryName: string | null
  amount: number
  period: BudgetPeriod
  alertThreshold: number
  active: boolean
  spent: number
  remaining: number
  ratio: number
}

export interface Goal {
  id: string
  name: string
  description: string | null
  targetAmount: number
  currentAmount: number
  progress: number
  deadline: string | null
  status: GoalStatus
}

export interface Insight {
  id: string
  type: string
  title: string
  body: string
  aiGenerated: boolean
  seenAt: string | null
  createdAt: string
}

export interface Report {
  id: string
  reportType: string
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'
  format: string
  periodStart: string
  periodEnd: string
  fileSize: number | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

export interface CategoryTotal {
  categoria: string
  total: number
}

export interface Summary {
  moeda: string
  mesAtual: {
    periodo: string
    totalGastos: number
    totalReceitas: number
    saldo: number
    movimentacoes: number
    gastosPorCategoria: CategoryTotal[]
  }
  mesAnterior: {
    totalGastos: number
    totalReceitas: number
  }
  ultimasTransacoes: Array<{
    data: string
    tipo: string
    valor: number
    estabelecimento: string | null
    categoria: string
    descricao: string | null
  }>
}
