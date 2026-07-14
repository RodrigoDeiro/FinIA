import { useState } from 'react'
import { Plus, Trash2, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/Layout'
import { Button, Card, Select, Input, Label, Spinner, EmptyState, ProgressBar, Badge } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { useBudgets, useCategories, useCreateBudget, useDeleteBudget } from '@/hooks/useApi'
import { formatMoney, formatPercent } from '@/lib/format'

const PERIOD_LABEL: Record<string, string> = { MONTHLY: 'Mensal', WEEKLY: 'Semanal', YEARLY: 'Anual' }

export function Budgets() {
  const { data: budgets, isLoading } = useBudgets()
  const del = useDeleteBudget()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title="Orçamentos"
        subtitle="Defina limites e receba alertas no WhatsApp"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : !budgets || budgets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet className="h-8 w-8" />}
            title="Nenhum orçamento"
            hint="Crie um limite por categoria e o FinIA te avisa ao chegar perto."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {budgets.map((b) => {
            const tone = b.ratio >= 1 ? 'red' : b.ratio >= b.alertThreshold ? 'amber' : 'green'
            return (
              <Card key={b.id}>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{b.categoryName ?? 'Categoria'}</p>
                    <Badge tone="slate">{PERIOD_LABEL[b.period]}</Badge>
                  </div>
                  <button
                    onClick={() => del.mutate(b.id)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <ProgressBar ratio={b.ratio} />
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    {formatMoney(b.spent)} de {formatMoney(b.amount)}
                  </span>
                  <Badge tone={tone}>{formatPercent(b.ratio)}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {b.remaining >= 0 ? `Restam ${formatMoney(b.remaining)}` : `Excedeu ${formatMoney(-b.remaining)}`}
                </p>
              </Card>
            )
          })}
        </div>
      )}

      {creating && <CreateBudgetModal onClose={() => setCreating(false)} />}
    </>
  )
}

function CreateBudgetModal({ onClose }: { onClose: () => void }) {
  const { data: categories } = useCategories()
  const create = useCreateBudget()
  const [form, setForm] = useState({ categoryId: '', amount: '', alertThreshold: '80' })

  // Categorias de despesa (esconde Receitas/Outros do seletor de orçamento)
  const options = categories?.filter((c) => !['receitas', 'outros'].includes(c.slug)) ?? []

  async function submit(): Promise<void> {
    const amount = Number(form.amount.replace(',', '.'))
    if (!form.categoryId || !(amount > 0)) return
    await create.mutateAsync({
      categoryId: form.categoryId,
      amount,
      alertThreshold: Number(form.alertThreshold) / 100,
    })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Novo orçamento">
      <div className="space-y-3">
        <div>
          <Label>Categoria</Label>
          <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Escolha…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Limite mensal (R$)</Label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <Label>Alertar em (%)</Label>
            <Input
              type="number"
              min={10}
              max={100}
              value={form.alertThreshold}
              onChange={(e) => setForm({ ...form, alertThreshold: e.target.value })}
            />
          </div>
        </div>
        {create.isError && <p className="text-sm text-red-500">Já existe um orçamento para esta categoria.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={create.isPending}>
            Criar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
