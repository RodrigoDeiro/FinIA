import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Target,
  FileText,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

const NAV = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/transacoes', label: 'Transações', icon: Receipt },
  { to: '/orcamentos', label: 'Orçamentos', icon: Wallet },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/relatorios', label: 'Relatórios', icon: FileText },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

// Sidebar responsiva: estática no desktop (md+), gaveta deslizante no mobile.
// `open`/`onClose` controlam a gaveta; no desktop ela fica sempre visível.
export function Sidebar({
  userName,
  open,
  onClose,
}: {
  userName: string | null
  open: boolean
  onClose: () => void
}) {
  async function logout(): Promise<void> {
    try {
      await api.authPost('/auth/logout')
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <>
      {/* Backdrop — só no mobile, quando a gaveta está aberta */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200',
          'md:static md:z-auto md:w-60 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <span className="text-2xl font-bold text-slate-800">
            Fin<span className="text-brand-500">IA</span>
          </span>
          {/* Fechar — só no mobile */}
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="px-3 pb-2 text-xs text-slate-400">{userName ?? 'Meu perfil'}</div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sair
          </button>
        </div>
      </aside>
    </>
  )
}
