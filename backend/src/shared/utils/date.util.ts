import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import 'dayjs/locale/pt-br.js'

// =============================================================================
// FinIA — Utilitários de Data
// =============================================================================
//
// Regra de ouro (decisão aprovada): datas SEMPRE em UTC no banco. O timezone
// do usuário é aplicado apenas na apresentação e ao interpretar entradas
// relativas ("hoje", "ontem"), que dependem do "hoje" local do usuário.
//
// dayjs é configurado uma única vez aqui com os plugins necessários. Demais
// módulos importam o `dayjs` já estendido deste arquivo.
//
// =============================================================================

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)
// Nomes de mês/dia em português ("julho de 2026", não "July de 2026")
dayjs.locale('pt-br')

export { dayjs }

/**
 * Instante atual em UTC, como Date — para gravar em colunas DateTime.
 */
export function nowUtc(): Date {
  return dayjs.utc().toDate()
}

/**
 * "Hoje" no fuso do usuário, retornado como Date em UTC apontando para o
 * início do dia local. Usado quando o parser identifica datas relativas.
 *
 * @param tz       timezone IANA do usuário (ex: 'America/Sao_Paulo')
 * @param dayOffset 0 = hoje, -1 = ontem, etc.
 */
export function userDayToUtc(tz: string, dayOffset = 0): Date {
  return dayjs()
    .tz(tz)
    .add(dayOffset, 'day')
    .startOf('day')
    .utc()
    .toDate()
}

/**
 * Formata uma data UTC no fuso do usuário (ex: "24/06/2026 15:30").
 */
export function formatInTz(date: Date, tz: string, format = 'DD/MM/YYYY HH:mm'): string {
  return dayjs.utc(date).tz(tz).format(format)
}

/**
 * Início do mês corrente no fuso do usuário, como Date em UTC.
 * Útil para agregações "gastos deste mês".
 */
export function startOfMonthUtc(tz: string): Date {
  return dayjs().tz(tz).startOf('month').utc().toDate()
}
