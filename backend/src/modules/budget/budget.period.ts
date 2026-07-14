import type { BudgetPeriod } from '@prisma/client'
import { dayjs } from '@shared/utils/date.util.js'

// =============================================================================
// FinIA — Janela de período de um orçamento
// =============================================================================
//
// Dado o tipo de período do budget e o fuso do usuário, calcula a janela
// CORRENTE (início/fim em UTC) e uma chave estável do período — usada para
// deduplicar alertas ("já avisei neste mês?").
//
//   MONTHLY → 1º ao último dia do mês    | chave "2026-07"
//   WEEKLY  → segunda a domingo          | chave "2026-W28" (semana da segunda)
//   YEARLY  → 1º jan a 31 dez            | chave "2026"
//
// =============================================================================

export interface PeriodWindow {
  start: Date
  end: Date
  /** Identificador estável do período corrente (dedupe de alertas) */
  key: string
  /** Rótulo em português para mensagens */
  label: string
}

export function currentPeriodWindow(period: BudgetPeriod, timezone: string): PeriodWindow {
  const now = dayjs().tz(timezone)

  switch (period) {
    case 'WEEKLY': {
      const monday = now.subtract((now.day() + 6) % 7, 'day').startOf('day')
      const sunday = monday.add(6, 'day').endOf('day')
      return {
        start: monday.utc().toDate(),
        end: sunday.utc().toDate(),
        key: `${monday.year()}-W${monday.format('MM-DD')}`,
        label: 'nesta semana',
      }
    }
    case 'YEARLY':
      return {
        start: now.startOf('year').utc().toDate(),
        end: now.endOf('year').utc().toDate(),
        key: now.format('YYYY'),
        label: 'neste ano',
      }
    case 'MONTHLY':
    default:
      return {
        start: now.startOf('month').utc().toDate(),
        end: now.endOf('month').utc().toDate(),
        key: now.format('YYYY-MM'),
        label: 'neste mês',
      }
  }
}
