import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Target,
  Lightbulb,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

const NAV = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/transacoes', label: 'Transações', icon: Receipt },
  { to: '/orcamentos', label: 'Orçamentos', icon: Wallet },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/relatorios', label: 'Relatórios', icon: FileText },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function Sidebar({ userName }: { userName: string | null }) {
  async function logout(): Promise<void> {
    try {
      await api.authPost('/auth/logout')
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="text-2xl font-bold text-slate-800">
          Fin<span className="text-brand-500">IA</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
  )
}
