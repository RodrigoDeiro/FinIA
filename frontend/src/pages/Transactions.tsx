import { useState } from 'react'
import { Plus, Trash2, AlertCircle, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/Layout'
import { Button, Card, Select, Input, Label, Badge, Spinner, EmptyState } from '@/components/ui'
import { Modal } from '@/components/Modal'
import {
  useTransactions,
  useCategories,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  type TransactionFilters,
} from '@/hooks/useApi'
import { formatMoney, formatDate } from '@/lib/format'
import type { ParseMethod, Transaction } from '@/types/api'

const TYPE_LABEL: Record<string, string> = {
  EXPENSE: 'Gasto',
  INCOME: 'Receita',
  INVESTMENT: 'Investimento',
  TRANSFER: 'Transferência',
  DEBT: 'Dívida',
}

const METHOD_BADGE: Record<ParseMethod, { tone: 'green' | 'blue' | 'slate'; label: string }> = {
  DETERMINISTIC: { tone: 'slate', label: 'auto' },
  AI: { tone: 'blue', label: 'IA' },
  HYBRID: { tone: 'blue', label: 'híbrido' },
  MANUAL: { tone: 'green', label: 'manual' },
}

export function Transactions() {
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, pageSize: 15 })
  const [creating, setCreating] = useState(false)
  const { data, isLoading } = useTransactions(filters)
  const { data: categories } = useCategories()

  const setFilter = (patch: Partial<TransactionFilters>): void =>
    setFilters((f) => ({ ...f, ...patch, page: 1 }))

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <>
      <PageHeader
        title="Transações"
        subtitle={data ? `${data.total} no total` : undefined}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nova
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Tipo</Label>
            <Select value={filters.type ?? ''} onChange={(e) => setFilter({ type: e.target.value || undefined })}>
              <option value="">Todos</option>
              {Object.entries(TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select
              value={filters.categoryId ?? ''}
              onChange={(e) => setFilter({ categoryId: e.target.value || undefined })}
            >
              <option value="">Todas</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Revisão</Label>
            <Select
              value={filters.needsReview ?? ''}
              onChange={(e) => setFilter({ needsReview: e.target.value || undefined })}
            >
              <option value="">Todas</option>
              <option value="true">A revisar</option>
              <option value="false">Confirmadas</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <Spinner label="Carregando…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="Nenhuma transação" hint="Registre um gasto pelo WhatsApp ou clique em Nova." />
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {data.items.map((t) => (
                <TransactionRow key={t.id} tx={t} />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>
                Página {data.page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={data.page <= 1}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  disabled={data.page >= totalPages}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {creating && <CreateModal onClose={() => setCreating(false)} />}
    </>
  )
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const [editing, setEditing] = useState(false)
  const { data: categories } = useCategories()
  const update = useUpdateTransaction()
  const del = useDeleteTransaction()
  const isIncome = tx.type === 'INCOME'
  const method = METHOD_BADGE[tx.parseMethod]

  async function correctCategory(categoryId: string): Promise<void> {
    await update.mutateAsync({ id: tx.id, data: { categoryId, needsReview: false } })
    setEditing(false)
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Badge tone={isIncome ? 'green' : 'slate'}>{tx.categoryName ?? 'Outros'}</Badge>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-700">
            {tx.merchantName ?? tx.description ?? TYPE_LABEL[tx.type]}
          </p>
          <p className="flex items-center gap-2 text-xs text-slate-400">
            {formatDate(tx.date)}
            <Badge tone={method.tone}>
              {tx.parseMethod === 'AI' && <Sparkles className="mr-0.5 inline h-3 w-3" />}
              {method.label}
            </Badge>
            {tx.needsReview && (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" /> revisar
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`whitespace-nowrap font-semibold ${isIncome ? 'text-brand-600' : 'text-slate-800'}`}>
          {isIncome ? '+' : '−'}
          {formatMoney(tx.amount, tx.currency)}
        </span>
        <button
          onClick={() => setEditing((v) => !v)}
          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
        >
          Corrigir
        </button>
        <button
          onClick={() => del.mutate(tx.id)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
          title="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {editing && (
        <Modal open onClose={() => setEditing(false)} title="Corrigir categoria">
          <p className="mb-3 text-sm text-slate-500">Escolha a categoria correta para esta transação.</p>
          <div className="grid grid-cols-2 gap-2">
            {categories?.map((c) => (
              <button
                key={c.id}
                onClick={() => void correctCategory(c.id)}
                disabled={update.isPending}
                className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
              >
                {c.name}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const { data: categories } = useCategories()
  const create = useCreateTransaction()
  const [form, setForm] = useState({
    type: 'EXPENSE',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    merchantName: '',
    categoryId: '',
  })

  async function submit(): Promise<void> {
    const amount = Number(form.amount.replace(',', '.'))
    if (!(amount > 0)) return
    await create.mutateAsync({
      type: form.type,
      amount,
      date: new Date(form.date).toISOString(),
      merchantName: form.merchantName || null,
      categoryId: form.categoryId || null,
    })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Nova transação">
      <div className="space-y-3">
        <div>
          <Label>Tipo</Label>
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.entries(TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valor (R$)</Label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Descrição / estabelecimento</Label>
          <Input
            placeholder="ex: Mercado"
            value={form.merchantName}
            onChange={(e) => setForm({ ...form, merchantName: e.target.value })}
          />
        </div>
        <div>
          <Label>Categoria</Label>
          <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Automática (Outros)</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={create.isPending}>
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
