import type { TransactionType } from '@prisma/client'
import { formatBRL } from '@shared/utils/currency.util.js'
import { formatInTz } from '@shared/utils/date.util.js'

// =============================================================================
// FinIA — Templates de Mensagem
// =============================================================================
//
// Funções puras que montam o texto enviado ao usuário via WhatsApp. Usam a
// formatação do WhatsApp (*negrito*, _itálico_). Centralizadas para manter o
// tom de voz consistente e facilitar futura internacionalização.
//
// =============================================================================

const TYPE_EMOJI: Record<TransactionType, string> = {
  EXPENSE: '💸',
  INCOME: '💰',
  INVESTMENT: '📈',
  TRANSFER: '🔄',
  DEBT: '🧾',
}

// Rótulo já com o particípio concordado (Receita registradA vs Gasto registradO)
const TYPE_LABEL: Record<TransactionType, string> = {
  EXPENSE: 'Gasto registrado',
  INCOME: 'Receita registrada',
  INVESTMENT: 'Investimento registrado',
  TRANSFER: 'Transferência registrada',
  DEBT: 'Dívida registrada',
}

export interface ConfirmationData {
  type: TransactionType
  amount: number
  currency: string
  merchantName: string | null
  date: Date
  timezone: string
  needsReview: boolean
}

/** Confirmação de uma transação registrada. */
export function transactionConfirmationTemplate(d: ConfirmationData): string {
  const where = d.merchantName ? ` em *${d.merchantName}*` : ''
  const when = formatInTz(d.date, d.timezone, 'DD/MM/YYYY')
  const value = formatBRL(d.amount, d.currency)

  let msg = `${TYPE_EMOJI[d.type]} *${TYPE_LABEL[d.type]}*\n${value}${where}\n🗓️ ${when}`

  if (d.needsReview) {
    msg += '\n\n_Registrei do meu jeito. Se algo estiver errado, é só me corrigir._'
  }
  return msg
}

/** Boas-vindas no primeiro contato (onboarding). */
export function welcomeTemplate(name?: string | null): string {
  const hi = name ? `Oi, ${name}!` : 'Oi!'
  return (
    `👋 ${hi} Eu sou o *FinIA*, seu assistente financeiro no WhatsApp.\n\n` +
    `Me manda seus gastos e receitas em texto, tipo:\n` +
    `• _Mercado 89,90_\n` +
    `• _Uber 25_\n` +
    `• _Recebi salário 5000_\n\n` +
    `Digite *ajuda* quando quiser ver exemplos. 💚`
  )
}

/** Ajuda / instruções de uso. */
export function helpTemplate(): string {
  return (
    `📖 *Como usar o FinIA*\n\n` +
    `Mande suas movimentações em texto livre:\n` +
    `• _iFood 45,90_ → gasto\n` +
    `• _gastei 30 na farmácia_\n` +
    `• _recebi 2000 de freela_ → receita\n` +
    `• _investi 500 no tesouro_ → investimento\n\n` +
    `Pode incluir datas: _uber 25 ontem_.\n\n` +
    `É só chamar. 💚`
  )
}

/** Mensagem não compreendida (sem valor identificável). */
export function notUnderstoodTemplate(originalText: string): string {
  return (
    `🤔 Não consegui entender _"${originalText}"_.\n\n` +
    `Tente incluir um valor, por exemplo:\n` +
    `• _Mercado 89,90_\n` +
    `• _Uber 25_\n\n` +
    `Digite *ajuda* para ver mais exemplos.`
  )
}

/** Mídia recebida (áudio/imagem) — ainda não suportada no Sprint 1. */
export function mediaUnsupportedTemplate(): string {
  return (
    `📎 Recebi sua mídia, mas por enquanto só consigo processar *texto*.\n\n` +
    `Me conta em palavras, tipo _Mercado 89,90_. 😉`
  )
}

/** Alerta de orçamento estourando o threshold (Sprint 4). */
export function budgetAlertTemplate(
  categoryName: string,
  spent: number,
  limit: number,
  periodLabel: string,
  currency: string,
): string {
  const pct = Math.round((spent / limit) * 100)
  const over = spent > limit
  return (
    `${over ? '🚨' : '⚠️'} *Orçamento de ${categoryName}*\n` +
    `Você já usou *${pct}%* do limite ${periodLabel}: ` +
    `${formatBRL(spent, currency)} de ${formatBRL(limit, currency)}.` +
    (over ? '\n\n_Limite estourado — vale dar uma olhada._' : '')
  )
}

/** Meta atingida (Sprint 4). */
export function goalAchievedTemplate(goalName: string, target: number, currency: string): string {
  return (
    `🎉 *Meta atingida: ${goalName}!*\n` +
    `Você juntou ${formatBRL(target, currency)}. Parabéns! 💚`
  )
}

/** Resumo semanal de insights (Sprint 4 — enviado pelo cron). */
export function insightsSummaryTemplate(titles: string[]): string {
  const bullets = titles.map((t) => `• ${t}`).join('\n')
  return (
    `💡 *Seus insights da semana*\n${bullets}\n\n` +
    `_Detalhes no painel — digite *dashboard* para acessar._`
  )
}

/** Magic link de acesso ao dashboard (Sprint 3). */
export function dashboardLinkTemplate(url: string): string {
  return (
    `🖥️ *Seu acesso ao painel FinIA*\n${url}\n\n` +
    `_Link de uso único, válido por 15 minutos. Se expirar, é só digitar *dashboard* de novo._`
  )
}
