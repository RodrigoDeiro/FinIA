import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
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
  const [navOpen, setNavOpen] = useState(false)

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
      <Sidebar userName={data.user.name} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior — só no mobile */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menu"
            className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-xl font-bold text-slate-800">
            Fin<span className="text-brand-500">IA</span>
          </span>
        </header>

        <main className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
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
