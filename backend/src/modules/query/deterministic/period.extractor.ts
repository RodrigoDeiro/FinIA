import { dayjs } from '@shared/utils/date.util.js'
import type { Dayjs } from 'dayjs'
import { normalizeText } from '@shared/utils/text.util.js'
import type { QueryPeriod } from '../types/query.types.js'

// =============================================================================
// FinIA — Period Extractor (consultas)
// =============================================================================
//
// Resolve o período de uma consulta ("quanto gastei ONTEM", "resumo do MÊS
// PASSADO"). Interpretado no fuso do usuário, devolvido em UTC (regra: UTC no
// banco). Sem menção explícita, assume o mês corrente — o período mais natural
// para perguntas financeiras.
//
// Semana começa na segunda-feira (convenção brasileira).
//
// =============================================================================

function period(start: Dayjs, end: Dayjs, label: string, explicit: boolean): QueryPeriod {
  return { start: start.utc().toDate(), end: end.utc().toDate(), label, explicit }
}

/** Segunda-feira da semana de `d`, à meia-noite local. */
function mondayOf(d: Dayjs): Dayjs {
  // dayjs.day(): 0=domingo ... 6=sábado → distância até a segunda anterior
  return d.subtract((d.day() + 6) % 7, 'day').startOf('day')
}

export function extractQueryPeriod(text: string, timezone: string): QueryPeriod {
  const t = normalizeText(text)
  const now = dayjs().tz(timezone)

  if (/\bhoje\b/.test(t)) {
    return period(now.startOf('day'), now, 'hoje', true)
  }

  if (/\bontem\b/.test(t)) {
    const y = now.subtract(1, 'day')
    return period(y.startOf('day'), y.endOf('day'), 'ontem', true)
  }

  if (/\bsemana passada\b/.test(t)) {
    const monday = mondayOf(now).subtract(7, 'day')
    return period(monday, monday.add(6, 'day').endOf('day'), 'na semana passada', true)
  }

  if (/\b(essa|esta|nessa|nesta) semana\b/.test(t)) {
    return period(mondayOf(now), now, 'nesta semana', true)
  }

  if (/\bmes passado\b/.test(t)) {
    const start = now.subtract(1, 'month').startOf('month')
    return period(start, start.endOf('month'), 'no mês passado', true)
  }

  if (/\b(esse|este|nesse|neste) ano\b/.test(t)) {
    return period(now.startOf('year'), now, 'neste ano', true)
  }

  if (/\b(esse|este|nesse|neste) mes\b/.test(t)) {
    return period(now.startOf('month'), now, 'neste mês', true)
  }

  // Default: mês corrente
  return period(now.startOf('month'), now, 'neste mês', false)
}
