import type { User } from '@prisma/client'
import type { CommandKind } from '../../types/message.types.js'
import {
  welcomeTemplate,
  helpTemplate,
  dashboardLinkTemplate,
} from '@modules/notification/templates/index.js'
import { createMagicLink } from '@modules/auth/magic-link.service.js'
import { computeMonthOverview } from '@modules/api/month.service.js'

// =============================================================================
// FinIA — Command Handlers
// =============================================================================
//
// Cada comando vira um texto de resposta. O processor é quem enfileira a
// notificação.
//
// Sprint 3: "dashboard" gera um MAGIC LINK real (token de uso único, 15 min)
// — o telefone é a identidade, então quem recebe a mensagem é quem entra.
//
// =============================================================================

export async function handleCommand(command: CommandKind, user: User): Promise<string> {
  switch (command) {
    case 'greeting':
      return welcomeTemplate(user.name)
    case 'help':
      return helpTemplate()
    case 'dashboard': {
      const url = await createMagicLink(user.id)
      return dashboardLinkTemplate(url)
    }
    case 'summary':
      return summaryText(user)
  }
}

/** Resumo consolidado do mês, formatado para o chat (Telegram/WhatsApp). */
async function summaryText(user: User): Promise<string> {
  const m = await computeMonthOverview(user.id, user.timezone)
  const fmt = (n: number): string =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: user.currency }).format(n)

  const lines = [
    `📊 Resumo de ${m.label}`,
    '',
    `Renda: ${fmt(m.income.total)}`,
    `Contas fixas: −${fmt(m.fixed)}`,
    `Cartão (parcelas): −${fmt(m.credit)}`,
    `Gastos variáveis: −${fmt(m.variable)}`,
    '———',
    `Sobra: ${fmt(m.balance)}`,
  ]

  if (m.byCategory.length > 0) {
    lines.push('', 'Maiores gastos:')
    for (const c of m.byCategory.slice(0, 4)) lines.push(`• ${c.name}: ${fmt(c.total)}`)
  }

  return lines.join('\n')
}
