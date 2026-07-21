import { dayjs } from '@shared/utils/date.util.js'
import { prisma } from '@database/prisma.js'

// =============================================================================
// FinIA — Visão consolidada do mês ("Meu mês")
// =============================================================================
//
// Junta o PLANEJADO (recorrentes: renda fixa + contas fixas) com o REAL
// (transações do mês) e o CARTÃO (parcelas agendadas para o mês), e calcula
// a sobra. Reutilizado pela API (/month) e pelo resumo do Telegram.
//
// =============================================================================

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const round2 = (n: number): number => Math.round(n * 100) / 100

export interface MonthOverview {
  month: string // 'YYYY-MM'
  label: string // 'julho de 2026'
  income: { recurring: number; transactions: number; total: number }
  fixed: number
  credit: number
  variable: number
  balance: number
  byCategory: { name: string; total: number }[]
}

export async function computeMonthOverview(
  userId: string,
  timezone: string,
  refMonth?: string,
): Promise<MonthOverview> {
  const base =
    refMonth && /^\d{4}-\d{2}$/.test(refMonth)
      ? dayjs.tz(`${refMonth}-01`, timezone)
      : dayjs().tz(timezone)

  const monthStart = base.startOf('month')
  const start = monthStart.utc().toDate()
  const end = base.endOf('month').utc().toDate()

  // ─── Transações reais do mês ────────────────────────────────────────────────
  const txs = await prisma.transaction.findMany({
    where: { userId, deletedAt: null, date: { gte: start, lte: end } },
    select: { type: true, amount: true, category: { select: { name: true } } },
  })

  let incomeTx = 0
  let variable = 0
  const catMap = new Map<string, number>()
  for (const t of txs) {
    const amt = Number(t.amount)
    if (t.type === 'INCOME') {
      incomeTx += amt
    } else if (t.type === 'EXPENSE') {
      variable += amt
      const name = t.category?.name ?? 'Outros'
      catMap.set(name, (catMap.get(name) ?? 0) + amt)
    }
  }

  // ─── Recorrentes (plano fixo) ───────────────────────────────────────────────
  const recs = await prisma.recurringEntry.findMany({
    where: { userId, deletedAt: null, active: true },
    select: { type: true, amount: true },
  })
  let recurringIncome = 0
  let fixed = 0
  for (const r of recs) {
    const amt = Number(r.amount)
    if (r.type === 'INCOME') recurringIncome += amt
    else if (r.type === 'EXPENSE') fixed += amt
  }

  // ─── Cartão: parcelas AGENDADAS para este mês ───────────────────────────────
  const purchases = await prisma.creditPurchase.findMany({
    where: { userId, deletedAt: null },
    select: { totalAmount: true, installments: true, firstDueDate: true },
  })
  let credit = 0
  for (const cp of purchases) {
    const first = dayjs(cp.firstDueDate).tz(timezone).startOf('month')
    const diff = monthStart.diff(first, 'month')
    if (diff >= 0 && diff < cp.installments) {
      credit += round2(Number(cp.totalAmount) / cp.installments)
    }
  }

  const incomeTotal = round2(recurringIncome + incomeTx)
  const byCategory = [...catMap.entries()]
    .map(([name, total]) => ({ name, total: round2(total) }))
    .sort((a, b) => b.total - a.total)

  return {
    month: base.format('YYYY-MM'),
    label: `${MESES[base.month()]} de ${base.year()}`,
    income: { recurring: round2(recurringIncome), transactions: round2(incomeTx), total: incomeTotal },
    fixed: round2(fixed),
    credit: round2(credit),
    variable: round2(variable),
    balance: round2(incomeTotal - fixed - credit - variable),
    byCategory,
  }
}
