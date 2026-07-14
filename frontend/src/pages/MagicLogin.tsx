import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ShieldX } from 'lucide-react'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

// =============================================================================
// FinIA — Consumo do Magic Link (/auth/magic?token=...)
// =============================================================================
//
// Troca o token de uso único por uma sessão (cookies httpOnly) e redireciona
// para o painel. StrictMode monta o efeito 2x em dev; o ref garante UMA troca.
//
// =============================================================================

export function MagicLogin() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [failed, setFailed] = useState(false)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    const token = params.get('token')
    if (!token) {
      setFailed(true)
      return
    }

    api
      .authPost('/auth/magic', { token })
      .then(() => {
        void qc.invalidateQueries()
        navigate('/', { replace: true })
      })
      .catch(() => setFailed(true))
  }, [params, navigate, qc])

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {failed ? (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <ShieldX className="h-7 w-7 text-red-500" />
            </div>
            <h1 className="mb-2 text-xl font-semibold text-slate-800">Link inválido ou expirado</h1>
            <p className="mb-6 text-sm text-slate-500">
              Os links de acesso valem por 15 minutos e só podem ser usados uma vez.
            </p>
            <Link
              to="/login"
              className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Como acessar de novo
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-brand-500" />
            <p className="text-slate-600">Validando seu acesso…</p>
          </>
        )}
      </div>
    </div>
  )
}
