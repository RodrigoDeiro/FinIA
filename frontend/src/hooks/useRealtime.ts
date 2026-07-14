import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// =============================================================================
// FinIA — Tempo real (SSE)
// =============================================================================
//
// Abre um EventSource em /api/v1/events (proxy → backend). A cada evento de
// transação, invalida as queries afetadas — a tela se atualiza sozinha quando
// um gasto é registrado pelo WhatsApp.
//
// EventSource envia cookies (same-origin via proxy) e reconecta sozinho.
//
// =============================================================================

export function useRealtime(enabled: boolean): void {
  const qc = useQueryClient()

  useEffect(() => {
    if (!enabled) return

    const source = new EventSource('/api/v1/events', { withCredentials: true })

    const invalidate = (): void => {
      void qc.invalidateQueries({ queryKey: ['transactions'] })
      void qc.invalidateQueries({ queryKey: ['summary'] })
      void qc.invalidateQueries({ queryKey: ['budgets'] })
      void qc.invalidateQueries({ queryKey: ['insights'] })
    }

    source.addEventListener('transaction.created', invalidate)
    source.addEventListener('transaction.updated', invalidate)
    source.addEventListener('transaction.deleted', invalidate)

    return () => source.close()
  }, [enabled, qc])
}
