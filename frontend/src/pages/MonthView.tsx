import { useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/Layout'
import { Button, Card, Select, Input, Spinner } from '@/components/ui'
import { useMonth, useRecurring, useCreateRecurring, useDeleteRecurring } from '@/hooks/useApi'
import { formatMoney } from '@/lib/format'
import type { RecurringEntry } from '@/types/api'

function currentMonthRef(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(ref: string, delta: number): string {
  const [y, m] = ref.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function MonthView() {
  const [ref, setRef] = useState(currentMonthRef())
  const { data, isLoading } = useMonth(ref)

  return (
    <>
      <PageHeader title="Meu mês" subtitle="Renda, contas fixas, cartão e o que sobra" />

      <div className="mb-4 flex items-center justify-between">
        <Button variant="secondary" onClick={() => setRef(shiftMonth(ref, -1))} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold capitalize text-slate-800">{data?.label ?? '…'}</span>
        <Button variant="secondary" onClick={() => setRef(shiftMonth(ref, 1))} aria-label="Próximo mês">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading || !data ? (
        <Spinner />
      ) : (
        <>
          <Card className="mb-4">
            <Line label="Renda" value={data.income.total} positive />
            <Line label="Contas fixas" value={-data.fixed} />
            <Line label="Cartão (parcelas)" value={-data.credit} />
            <Line label="Gastos variáveis" value={-data.variable} />
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="font-semibold text-slate-800">Sobra do mês</span>
              <span
                className={`text-lg font-bold ${data.balance >= 0 ? 'text-brand-600' : 'text-red-500'}`}
              >
                {formatMoney(data.balance)}
              </span>
            </div>
          </Card>

          {data.byCategory.length > 0 && (
            <Card className="mb-4">
              <h3 className="mb-3 font-semibold text-slate-700">Gastos por categoria</h3>
              <div className="space-y-2">
                {data.byCategory.slice(0, 6).map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{c.name}</span>
                    <span className="font-medium text-slate-800">{formatMoney(c.total)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <RecurringManager />
    </>
  )
}

function Line({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={positive ? 'font-medium text-brand-600' : 'font-medium text-slate-800'}>
        {formatMoney(value)}
      </span>
    </div>
  )
}

function RecurringManager() {
  const { data: items } = useRecurring()
  const create = useCreateRecurring()
  const del = useDeleteRecurring()
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount.replace(',', '.'))
    if (!description.trim() || !(value > 0)) return
    await create.mutateAsync({ type, description: description.trim(), amount: value })
    setDescription('')
    setAmount('')
  }

  const income = items?.filter((i) => i.type === 'INCOME') ?? []
  const fixed = items?.filter((i) => i.type === 'EXPENSE') ?? []

  return (
    <Card>
      <h3 className="mb-1 font-semibold text-slate-700">Recorrentes do mês</h3>
      <p className="mb-3 text-xs text-slate-400">
        Cadastre o que se repete todo mês: renda fixa (salário) e contas fixas (aluguel, assinaturas…).
      </p>

      <form onSubmit={add} className="mb-4 space-y-2">
        <div className="flex gap-2">
          <Select value={type} onChange={(e) => setType(e.target.value as 'EXPENSE' | 'INCOME')} style={{ maxWidth: 140 }}>
            <option value="EXPENSE">Conta fixa</option>
            <option value="INCOME">Renda</option>
          </Select>
          <Input
            placeholder="Descrição (ex: Aluguel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder="Valor (R$)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button type="submit" loading={create.isPending}>
            Adicionar
          </Button>
        </div>
      </form>

      <RecurringList title="Renda fixa" items={income} onDelete={(id) => del.mutate(id)} tone="income" />
      <RecurringList title="Contas fixas" items={fixed} onDelete={(id) => del.mutate(id)} tone="expense" />
    </Card>
  )
}

function RecurringList({
  title,
  items,
  onDelete,
  tone,
}: {
  title: string
  items: RecurringEntry[]
  onDelete: (id: string) => void
  tone: 'income' | 'expense'
}) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1 text-xs font-medium text-slate-400">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhum cadastrado.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between py-2 text-sm">
              <span className="min-w-0 truncate text-slate-700">{i.description}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className={tone === 'income' ? 'font-medium text-brand-600' : 'font-medium text-slate-800'}>
                  {formatMoney(i.amount)}
                </span>
                <button
                  onClick={() => onDelete(i.id)}
                  aria-label={`Remover ${i.description}`}
                  className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
