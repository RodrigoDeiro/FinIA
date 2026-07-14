import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Account,
  Budget,
  Category,
  Goal,
  Insight,
  Report,
  Summary,
  Transaction,
  TransactionPage,
  User,
} from '@/types/api'

// =============================================================================
// FinIA — Hooks de dados (TanStack Query)
// =============================================================================

// ─── Sessão / recursos ────────────────────────────────────────────────────────
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: User; accounts: Account[] }>('/me'),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: Category[] }>('/categories'),
    staleTime: 5 * 60_000,
    select: (d) => d.categories,
  })
}

export function useSummary() {
  return useQuery({ queryKey: ['summary'], queryFn: () => api.get<Summary>('/summary') })
}

// ─── Transações ───────────────────────────────────────────────────────────────
export interface TransactionFilters {
  type?: string
  categoryId?: string
  needsReview?: string
  page?: number
  pageSize?: number
}

export function useTransactions(filters: TransactionFilters) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => api.get<TransactionPage>(`/transactions${qs ? `?${qs}` : ''}`),
  })
}

export interface CreateTransactionInput {
  type: string
  amount: number
  date: string
  description?: string | null
  merchantName?: string | null
  categoryId?: string | null
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTransactionInput) => api.post<Transaction>('/transactions', input),
    onSuccess: () => invalidateFinance(qc),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<Transaction>(`/transactions/${id}`, data),
    onSuccess: () => invalidateFinance(qc),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/transactions/${id}`),
    onSuccess: () => invalidateFinance(qc),
  })
}

// ─── Orçamentos ────────────────────────────────────────────────────────────────
export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: () => api.get<{ budgets: Budget[] }>('/budgets'),
    select: (d) => d.budgets,
  })
}

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { categoryId: string; amount: number; alertThreshold?: number; period?: string }) =>
      api.post<{ id: string }>('/budgets', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/budgets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
}

// ─── Metas ──────────────────────────────────────────────────────────────────────
export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get<{ goals: Goal[] }>('/goals'),
    select: (d) => d.goals,
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; targetAmount: number; description?: string | null }) =>
      api.post<{ id: string }>('/goals', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useDepositGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.post<{ currentAmount: number; achieved: boolean }>(`/goals/${id}/deposit`, { amount }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/goals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

// ─── Insights ────────────────────────────────────────────────────────────────────
export function useInsights() {
  return useQuery({
    queryKey: ['insights'],
    queryFn: () => api.get<{ insights: Insight[] }>('/insights'),
    select: (d) => d.insights,
  })
}

export function useGenerateInsights() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ status: string }>('/insights/generate'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights'] }),
  })
}

export function useDismissInsight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch<{ ok: boolean }>(`/insights/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights'] }),
  })
}

// ─── Relatórios ────────────────────────────────────────────────────────────────
export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: () => api.get<{ reports: Report[] }>('/reports'),
    select: (d) => d.reports,
    refetchInterval: (query) => {
      // Enquanto houver relatório em processamento, refaz a cada 2s
      const reports = query.state.data?.reports ?? []
      return reports.some((r) => r.status === 'PENDING' || r.status === 'GENERATING') ? 2000 : false
    },
  })
}

export function useCreateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ id: string; status: string }>('/reports'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })
}

function invalidateFinance(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: ['transactions'] })
  void qc.invalidateQueries({ queryKey: ['summary'] })
  void qc.invalidateQueries({ queryKey: ['budgets'] })
}
