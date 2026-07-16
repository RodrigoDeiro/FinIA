import { useState } from 'react'
import { Plus, Trash2, CreditCard as CreditCardIcon } from 'lucide-react'
import { PageHeader } from '@/components/Layout'
import { Button, Card, Input, Label, Spinner, EmptyState, ProgressBar, Badge } from '@/components/ui'
import { Modal } from '@/components/Modal'
import {
  useCreditPurchases,
  useCreateCreditPurchase,
  useDeleteCreditPurchase,
  usePayInstallment,
  useUnpayInstallment,
} from '@/hooks/useApi'
import { formatMoney, formatDate } from '@/lib/format'
import type { CreditPurchase } from '@/types/api'

export function CreditCard() {
  const { data, isLoading } = useCreditPurchases()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title="Cartão de crédito"
        subtitle="Compras parceladas e acompanhamento"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nova compra
          </Button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : !data || data.purchases.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CreditCardIcon className="h-8 w-8" />}
            title="Nenhuma compra parcelada"
            hint="Cadastre uma compra no cartão e acompanhe quantas parcelas faltam."
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric label="Comprometido por mês" value={formatMoney(data.summary.monthlyCommitment)} />
            <Metric label="Dívida restante" value={formatMoney(data.summary.totalRemaining)} />
            <Metric label="Compras ativas" value={String(data.summary.activeCount)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.purchases.map((p) => (
              <PurchaseCard key={p.id} purchase={p} />
            ))}
          </div>
        </>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} />}
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function PurchaseCard({ purchase: p }: { purchase: CreditPurchase }) {
  const del = useDeleteCreditPurchase()
  const pay = usePayInstallment()
  const unpay = useUnpayInstallment()
  const done = p.remainingCount === 0

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-800">{p.description}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {p.card && <Badge tone="slate">{p.card}</Badge>}
            <span>
              {formatMoney(p.totalAmount)} em {p.installments}x
            </span>
          </div>
        </div>
        <button
          onClick={() => del.mutate(p.id)}
          aria-label="Remover"
          className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <p className="mb-1 text-sm text-slate-600">
        <span className="font-semibold text-slate-800">{formatMoney(p.installmentAmount)}</span>
        <span className="text-slate-400"> / mês</span>
      </p>

      <ProgressBar ratio={p.progress} positiveWhenFull />

      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-slate-500">
          {p.paidCount} de {p.installments} pagas
        </span>
        <Badge tone={done ? 'green' : 'slate'}>
          {done ? 'Quitada' : `faltam ${p.remainingCount}`}
        </Badge>
      </div>

      {!done && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-xs text-slate-400">
          <span>Restam {formatMoney(p.remainingAmount)}</span>
          {p.nextDueDate && <span>Próxima: {formatDate(p.nextDueDate)}</span>}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {!done && (
          <Button className="flex-1" onClick={() => pay.mutate(p.id)} loading={pay.isPending}>
            Paguei uma parcela
          </Button>
        )}
        {p.paidCount > 0 && (
          <Button variant="secondary" onClick={() => unpay.mutate(p.id)} loading={unpay.isPending}>
            Desfazer
          </Button>
        )}
      </div>
    </Card>
  )
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const create = useCreateCreditPurchase()
  const [form, setForm] = useState({
    description: '',
    totalAmount: '',
    installments: '1',
    firstDueDate: new Date().toISOString().slice(0, 10),
    card: '',
  })

  const total = Number(form.totalAmount.replace(',', '.'))
  const n = Number(form.installments)
  const perMonth = total > 0 && n > 0 ? total / n : 0

  async function submit(): Promise<void> {
    if (!form.description.trim() || !(total > 0) || !(n >= 1)) return
    await create.mutateAsync({
      description: form.description.trim(),
      totalAmount: total,
      installments: Math.round(n),
      firstDueDate: new Date(form.firstDueDate).toISOString(),
      card: form.card.trim() || null,
    })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Nova compra parcelada">
      <div className="space-y-3">
        <div>
          <Label>Descrição</Label>
          <Input
            placeholder="ex: Geladeira"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valor total (R$)</Label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={form.totalAmount}
              onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
            />
          </div>
          <div>
            <Label>Parcelas (x)</Label>
            <Input
              type="number"
              min={1}
              max={72}
              value={form.installments}
              onChange={(e) => setForm({ ...form, installments: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Data da compra</Label>
            <Input
              type="date"
              value={form.firstDueDate}
              onChange={(e) => setForm({ ...form, firstDueDate: e.target.value })}
            />
          </div>
          <div>
            <Label>Cartão (opcional)</Label>
            <Input
              placeholder="ex: Nubank"
              value={form.card}
              onChange={(e) => setForm({ ...form, card: e.target.value })}
            />
          </div>
        </div>

        {perMonth > 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {Math.round(n)}x de <span className="font-semibold">{formatMoney(perMonth)}</span> por mês
          </p>
        )}

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
