import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { MagicLogin } from '@/pages/MagicLogin'
import { Dashboard } from '@/pages/Dashboard'
import { Transactions } from '@/pages/Transactions'
import { CreditCard } from '@/pages/CreditCard'
import { Budgets } from '@/pages/Budgets'
import { Goals } from '@/pages/Goals'
import { Reports } from '@/pages/Reports'
import { Settings } from '@/pages/Settings'

// =============================================================================
// FinIA — Rotas
// =============================================================================
//
// Públicas: /login e /auth/magic (consumo do magic link).
// Protegidas: tudo dentro de <Layout> (valida a sessão via useMe → redirect).
//
// =============================================================================

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/auth/magic" element={<MagicLogin />} />

        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="transacoes" element={<Transactions />} />
          <Route path="cartao" element={<CreditCard />} />
          <Route path="orcamentos" element={<Budgets />} />
          <Route path="metas" element={<Goals />} />
          <Route path="relatorios" element={<Reports />} />
          <Route path="configuracoes" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
