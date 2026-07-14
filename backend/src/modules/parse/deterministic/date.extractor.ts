import { dayjs, userDayToUtc, nowUtc } from '@shared/utils/date.util.js'
import type { ExtractedDate } from '../types/parse-result.type.js'

// =============================================================================
// FinIA — Date Extractor
// =============================================================================
//
// Reconhece datas relativas e explícitas. A data é interpretada no fuso do
// usuário e devolvida em UTC (regra: UTC no banco).
//
//   "hoje"        → hoje
//   "ontem"       → ontem
//   "anteontem"   → 2 dias atrás
//   "DD/MM"       → dia/mês do ano corrente (ou anterior, se cairia no futuro)
//   "DD/MM/YYYY"  → data completa
//   (nada)        → assume agora (explicit: false)
//
// =============================================================================

const RELATIVE: Array<{ re: RegExp; offset: number; label: string }> = [
  { re: /\banteontem\b/i, offset: -2, label: 'anteontem' },
  { re: /\bontem\b/i, offset: -1, label: 'ontem' },
  { re: /\bhoje\b/i, offset: 0, label: 'hoje' },
]

// DD/MM ou DD-MM, opcionalmente com /YYYY
const NUMERIC_DATE_RE = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/

export function extractDate(text: string, timezone: string): ExtractedDate {
  // 1. Datas relativas
  for (const r of RELATIVE) {
    if (r.re.test(text)) {
      return { date: userDayToUtc(timezone, r.offset), raw: r.label, explicit: true }
    }
  }

  // 2. Data numérica DD/MM[/YYYY]
  const m = text.match(NUMERIC_DATE_RE)
  if (m) {
    const day = Number(m[1])
    const month = Number(m[2])
    const yearRaw = m[3]

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const now = dayjs().tz(timezone)
      let year: number
      if (yearRaw) {
        year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw)
      } else {
        year = now.year()
      }

      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      // Validação ESTRITA (3º arg = true): rejeita datas impossíveis como
      // 31/02, que o dayjs não-estrito "rolaria" para o mês seguinte.
      if (dayjs(iso, 'YYYY-MM-DD', true).isValid()) {
        let candidate = dayjs.tz(iso, 'YYYY-MM-DD', timezone)

        // Sem ano explícito e data no futuro → assume o ano anterior
        if (!yearRaw && candidate.isAfter(now)) {
          candidate = candidate.subtract(1, 'year')
        }
        return {
          date: candidate.startOf('day').utc().toDate(),
          raw: m[0],
          explicit: true,
        }
      }
    }
  }

  // 3. Default: agora
  return { date: nowUtc(), raw: null, explicit: false }
}
