import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney } from '@/lib/format'

// =============================================================================
// FinIA — Gráficos (Recharts)
// =============================================================================

const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']

export interface Slice {
  label: string
  value: number
}

export function CategoryDonut({ data }: { data: Slice[] }) {
  if (data.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatMoney(Number(v))} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function MonthlyBars({ data }: { data: Array<{ label: string; gastos: number; receitas: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barGap={4}>
        <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={48} tickFormatter={(v) => `${Number(v)}`} />
        <Tooltip formatter={(v) => formatMoney(Number(v))} />
        <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Legend({ data }: { data: Slice[] }) {
  return (
    <ul className="space-y-1.5">
      {data.map((s, i) => (
        <li key={s.label} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="text-slate-600">{s.label}</span>
          </span>
          <span className="font-medium text-slate-800">{formatMoney(s.value)}</span>
        </li>
      ))}
    </ul>
  )
}
