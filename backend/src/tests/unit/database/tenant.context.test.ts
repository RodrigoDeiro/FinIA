import { describe, it, expect } from 'vitest'
import { runWithTenant, getTenantUserId } from '@database/tenant.context.js'

// =============================================================================
// FinIA — Testes: Tenant Context (AsyncLocalStorage)
// =============================================================================

describe('tenant context', () => {
  it('fora de contexto → null', () => {
    expect(getTenantUserId()).toBeNull()
  })

  it('dentro de runWithTenant → userId', () => {
    runWithTenant('user-abc', () => {
      expect(getTenantUserId()).toBe('user-abc')
    })
  })

  it('sobrevive a awaits (contexto assíncrono)', async () => {
    await runWithTenant('user-async', async () => {
      await new Promise((r) => setTimeout(r, 5))
      expect(getTenantUserId()).toBe('user-async')
    })
  })

  it('contextos concorrentes não vazam entre si', async () => {
    const results = await Promise.all([
      runWithTenant('user-1', async () => {
        await new Promise((r) => setTimeout(r, 10))
        return getTenantUserId()
      }),
      runWithTenant('user-2', async () => {
        await new Promise((r) => setTimeout(r, 5))
        return getTenantUserId()
      }),
    ])
    expect(results).toEqual(['user-1', 'user-2'])
  })
})
