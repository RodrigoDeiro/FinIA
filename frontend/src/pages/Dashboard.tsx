import { ArrowDownRight, ArrowUpRight, Scale, Receipt } from 'lucide-react'
import type { ReactNode } from 'react'
import { PageHeader } from '@/components/Layout'
import { Card, Spinner, EmptyState, Badge } from '@/components/ui'
import { CategoryDonut, Legend, MonthlyBars, type Slice } from '@/components/charts'
import { useSummary } from '@/hooks/useApi'
import { formatMoney } from '@/lib/format'

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  tone: 'green' | 'red' | 'slate'
}) {
  const toneClass = tone === 'green' ? 'text-brand-600' : tone === 'red' ? 'text-red-500' : 'text-slate-800'
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
          {icon}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
          <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
        </div>
      </div>
    </Card>
  )
}

export function Dashboard() {
  const { data, isLoading } = useSummary()

  if (isLoading) return <Spinner label="Carregando resumo…" />
  if (!data) return <EmptyState title="Sem dados ainda" hint="Registre gastos pelo WhatsApp para começar." />

  const m = data.mesAtual
  const slices: Slice[] = m.gastosPorCategoria.map((c) => ({ label: c.categoria, value: c.total }))
  const bars = [
    { label: 'Mês passado', gastos: data.mesAnterior.totalGastos, receitas: data.mesAnterior.totalReceitas },
    { label: 'Este mês', gastos: m.totalGastos, receitas: m.totalReceitas },
  ]

  return (
    <>
      <PageHeader title="Visão geral" subtitle={m.periodo} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<ArrowUpRight className="h-5 w-5" />} label="Entradas" value={formatMoney(m.totalReceitas, data.moeda)} tone="green" />
        <Kpi icon={<ArrowDownRight className="h-5 w-5" />} label="Saídas" value={formatMoney(m.totalGastos, data.moeda)} tone="red" />
        <Kpi icon={<Scale className="h-5 w-5" />} label="Saldo" value={formatMoney(m.saldo, data.moeda)} tone={m.saldo >= 0 ? 'green' : 'red'} />
        <Kpi icon={<Receipt className="h-5 w-5" />} label="Movimentações" value={String(m.movimentacoes)} tone="slate" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold text-slate-700">Este mês vs. anterior</h3>
          <MonthlyBars data={bars} />
        </Card>

        <Card>
          <h3 className="mb-4 font-semibold text-slate-700">Gastos por categoria</h3>
          {slices.length === 0 ? (
            <EmptyState title="Nenhum gasto neste mês" />
          ) : (
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
              <CategoryDonut data={slices} />
              <Legend data={slices.slice(0, 6)} />
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="mb-4 font-semibold text-slate-700">Últimas movimentações</h3>
        {data.ultimasTransacoes.length === 0 ? (
          <EmptyState title="Nada por aqui ainda" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.ultimasTransacoes.map((t, i) => {
              const isIncome = t.tipo === 'INCOME'
              return (
                <li key={i} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Badge tone={isIncome ? 'green' : 'slate'}>{t.categoria}</Badge>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {t.estabelecimento ?? t.descricao ?? 'Movimentação'}
                      </p>
                      <p className="text-xs text-slate-400">{t.data}</p>
                    </div>
                  </div>
                  <span className={`font-semibold ${isIncome ? 'text-brand-600' : 'text-slate-800'}`}>
                    {isIncome ? '+' : '−'}
                    {formatMoney(t.valor, data.moeda)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}
