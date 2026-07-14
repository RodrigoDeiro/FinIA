import { describe, it, expect, afterAll } from 'vitest'
import { processIncomingMessage } from '@modules/message/message.processor.js'
import type { NormalizedMessage } from '@modules/whatsapp/types/normalized-message.type.js'
import { prisma } from '@database/prisma.js'
import { randomToken } from '@shared/utils/crypto.util.js'
import { notificationQueue, closeQueues } from '@queue/queues.js'
import { disconnectRedis } from '@cache/redis.js'
import { disconnectDatabase } from '@database/prisma.js'

// =============================================================================
// FinIA — Teste de Integração: Pipeline completo
// =============================================================================
//
// Chama processIncomingMessage diretamente (o que o MessageWorker faria) e
// verifica o efeito no banco: usuário criado pelo telefone, conta padrão e
// transação registrada. Usa Postgres/Redis reais. Limpa os dados no fim.
//
// =============================================================================

// Número exclusivo do teste para não colidir com dados reais
const PHONE = '+5511900000777'

function makeMessage(text: string): NormalizedMessage {
  return {
    provider: 'evolution',
    providerMessageId: `pipe-${randomToken(8)}`,
    from: PHONE,
    to: null,
    type: 'text',
    text,
    mediaUrl: null,
    timestamp: new Date(),
    fromMe: false,
  }
}

describe('Pipeline: mensagem → transação', () => {
  afterAll(async () => {
    // Limpeza: remove tudo que o teste criou para este número
    const user = await prisma.user.findFirst({ where: { phoneNumber: PHONE } })
    if (user) {
      await prisma.messageLog.deleteMany({ where: { userId: user.id } })
      await prisma.transaction.deleteMany({ where: { userId: user.id } })
      await prisma.account.deleteMany({ where: { userId: user.id } })
      await prisma.user.delete({ where: { id: user.id } })
    }
    await notificationQueue.obliterate({ force: true })
    await closeQueues()
    await disconnectRedis()
    await disconnectDatabase()
  })

  it('cria usuário + conta padrão na primeira mensagem', async () => {
    await processIncomingMessage(makeMessage('iFood 45,90'))

    const user = await prisma.user.findFirst({
      where: { phoneNumber: PHONE },
      include: { accounts: true },
    })
    expect(user).not.toBeNull()
    expect(user?.accounts).toHaveLength(1)
    expect(user?.accounts[0]?.isDefault).toBe(true)
    expect(user?.accounts[0]?.name).toBe('Principal')
  })

  it('registra a transação parseada (iFood → Alimentação, R$45,90)', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { phoneNumber: PHONE } })
    const tx = await prisma.transaction.findFirst({
      where: { userId: user.id, merchantName: 'iFood' },
    })
    expect(tx).not.toBeNull()
    expect(tx?.type).toBe('EXPENSE')
    expect(Number(tx?.amount)).toBe(45.9)
    expect(tx?.parseMethod).toBe('DETERMINISTIC')
    expect(tx?.needsReview).toBe(true) // confiança 0.80 → revisão
  })

  it('grava o MessageLog vinculado à transação', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { phoneNumber: PHONE } })
    const log = await prisma.messageLog.findFirst({
      where: { userId: user.id, transactionId: { not: null } },
    })
    expect(log).not.toBeNull()
    expect(log?.provider).toBe('evolution')
    expect(log?.processed).toBe(true)
  })

  it('mensagem sem valor não cria transação (comando "ajuda")', async () => {
    await processIncomingMessage(makeMessage('ajuda'))
    const user = await prisma.user.findFirstOrThrow({ where: { phoneNumber: PHONE } })
    const count = await prisma.transaction.count({ where: { userId: user.id } })
    // Só a transação do iFood do primeiro teste — "ajuda" é comando, não gera tx
    expect(count).toBe(1)
  })
})
