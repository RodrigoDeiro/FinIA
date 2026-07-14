import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'

dayjs.locale('pt-br')

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatMoney(value: number, currency = 'BRL'): string {
  if (currency === 'BRL') return brl.format(value)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value)
}

export function formatDate(iso: string, pattern = 'DD/MM/YYYY'): string {
  return dayjs(iso).format(pattern)
}

export function formatDateTime(iso: string): string {
  return dayjs(iso).format('DD/MM/YYYY HH:mm')
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

export function fromNow(iso: string): string {
  const d = dayjs(iso)
  const days = dayjs().diff(d, 'day')
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return d.format('DD/MM/YYYY')
}
