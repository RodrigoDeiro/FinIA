import type { User } from '@prisma/client'
import type { CommandKind } from '../../types/message.types.js'
import {
  welcomeTemplate,
  helpTemplate,
  dashboardLinkTemplate,
} from '@modules/notification/templates/index.js'
import { createMagicLink } from '@modules/auth/magic-link.service.js'

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
  }
}
