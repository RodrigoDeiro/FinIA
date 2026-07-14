import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Spinner } from './ui'
import { useMe } from '@/hooks/useApi'
import { useRealtime } from '@/hooks/useRealtime'

// =============================================================================
// FinIA — Layout autenticado (shell + sidebar)
// =============================================================================
//
// Porta de entrada da área logada:
//   - useMe() valida a sessão (401 → o api client dispara 'finia:unauthorized').
//   - ao receber o evento, redireciona para /login.
//   - useRealtime liga o SSE enquanto o usuário está logado.
//
// =============================================================================

export function Layout() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useMe()

  useRealtime(Boolean(data))

  useEffect(() => {
    const onUnauthorized = (): void => navigate('/login', { replace: true })
    window.addEventListener('finia:unauthorized', onUnauthorized)
    return () => window.removeEventListener('finia:unauthorized', onUnauthorized)
  }, [navigate])

  useEffect(() => {
    if (isError) navigate('/login', { replace: true })
  }, [isError, navigate])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Carregando…" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="flex h-full">
      <Sidebar userName={data.user.name} />
      <main className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
