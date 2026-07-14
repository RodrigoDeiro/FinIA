import { useState } from 'react'
import { Plus, Trash2, Target, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/Layout'
import { Button, Card, Input, Label, Spinner, EmptyState, ProgressBar, Badge } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { useGoals, useCreateGoal, useDepositGoal, useDeleteGoal } from '@/hooks/useApi'
import { formatMoney, formatPercent } from '@/lib/format'
import type { Goal } from '@/types/api'

export function Goals() {
  const { data: goals, isLoading } = useGoals()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title="Metas"
        subtitle="Junte dinheiro para seus objetivos"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nova
          </Button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : !goals || goals.length === 0 ? (
        <Card>
          <EmptyState icon={<Target className="h-8 w-8" />} title="Nenhuma meta" hint="Crie um objetivo e acompanhe o progresso." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      )}

      {creating && <CreateGoalModal onClose={() => setCreating(false)} />}
    </>
  )
}

function GoalCard({ goal }: { goal: Goal }) {
  const deposit = useDepositGoal()
  const del = useDeleteGoal()
  const [depositing, setDepositing] = useState(false)
  const [amount, setAmount] = useState('')
  const achieved = goal.status === 'ACHIEVED'

  async function submit(): Promise<void> {
    const value = Number(amount.replace(',', '.'))
    if (!(value > 0)) return
    await deposit.mutateAsync({ id: goal.id, amount: value })
    setAmount('')
    setDepositing(false)
  }

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="flex items-center gap-2 font-semibold text-slate-800">
            {goal.name}
            {achieved && <CheckCircle2 className="h-4 w-4 text-brand-500" />}
          </p>
          {goal.description && <p className="text-xs text-slate-400">{goal.description}</p>}
        </div>
        <button
          onClick={() => del.mutate(goal.id)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <ProgressBar ratio={goal.progress} positiveWhenFull />
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-slate-500">
          {formatMoney(goal.currentAmount)} de {formatMoney(goal.targetAmount)}
        </span>
        <Badge tone={achieved ? 'green' : 'slate'}>{achieved ? 'Concluída' : formatPercent(goal.progress)}</Badge>
      </div>

      {!achieved && (
        <div className="mt-3">
          {depositing ? (
            <div className="flex gap-2">
              <Input
                autoFocus
                inputMode="decimal"
                placeholder="Valor (R$)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Button onClick={() => void submit()} loading={deposit.isPending}>
                Ok
              </Button>
            </div>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setDepositing(true)}>
              Depositar
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

function CreateGoalModal({ onClose }: { onClose: () => void }) {
  const create = useCreateGoal()
  const [form, setForm] = useState({ name: '', targetAmount: '', description: '' })

  async function submit(): Promise<void> {
    const target = Number(form.targetAmount.replace(',', '.'))
    if (!form.name || !(target > 0)) return
    await create.mutateAsync({
      name: form.name,
      targetAmount: target,
      description: form.description || null,
    })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Nova meta">
      <div className="space-y-3">
        <div>
          <Label>Nome</Label>
          <Input
            placeholder="ex: Reserva de emergência"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <Label>Valor alvo (R$)</Label>
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={form.targetAmount}
            onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
          />
        </div>
        <div>
          <Label>Descrição (opcional)</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
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
