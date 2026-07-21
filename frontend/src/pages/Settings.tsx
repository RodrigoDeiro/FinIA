import { useState, type FormEvent } from 'react'
import { X, Check } from 'lucide-react'
import { PageHeader } from '@/components/Layout'
import { Card, Spinner, Badge, Button } from '@/components/ui'
import {
  useMe,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useTelegramStatus,
  useTelegramConnect,
  useTelegramDisconnect,
} from '@/hooks/useApi'
import { formatDate } from '@/lib/format'
import { api, ApiError } from '@/lib/api'

const ACCOUNT_TYPE: Record<string, string> = {
  CHECKING: 'Conta corrente',
  SAVINGS: 'Poupança',
  CREDIT_CARD: 'Cartão de crédito',
  INVESTMENT: 'Investimentos',
  CASH: 'Dinheiro',
  WALLET: 'Carteira digital',
  OTHER: 'Outra',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  )
}

function PasswordCard({ currentEmail }: { currentEmail: string | null }) {
  const [email, setEmail] = useState(currentEmail ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    setSaving(true)
    try {
      await api.post('/auth/set-password', { email, password })
      setDone(true)
      setPassword('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <h3 className="mb-1 font-semibold text-slate-700">Acesso por senha</h3>
      <p className="mb-3 text-xs text-slate-400">
        Defina um email e uma senha para entrar no painel sem depender do WhatsApp.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nova senha (mín. 8 caracteres)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {done && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">Senha salva! Já pode entrar com email e senha.</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar senha'}
        </button>
      </form>
    </Card>
  )
}

function CategoriesCard() {
  const { data: categories } = useCategories()
  const create = useCreateCategory()
  const del = useDeleteCategory()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const n = name.trim()
    if (!n) return
    try {
      await create.mutateAsync(n)
      setName('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar.')
    }
  }

  const userCats = categories?.filter((c) => c.origin === 'USER') ?? []
  const systemCats = categories?.filter((c) => c.origin === 'SYSTEM') ?? []

  return (
    <Card>
      <h3 className="mb-1 font-semibold text-slate-700">Categorias</h3>
      <p className="mb-3 text-xs text-slate-400">
        Crie as suas e remova as que não usa. As padrão ficam sempre disponíveis.
      </p>

      <form onSubmit={add} className="mb-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nova categoria (ex: Pets)"
          maxLength={60}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <Button type="submit" loading={create.isPending}>
          Adicionar
        </Button>
      </form>
      {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {userCats.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {userCats.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
            >
              {c.name}
              <button
                onClick={() => del.mutate(c.id)}
                aria-label={`Remover ${c.name}`}
                className="rounded-full p-0.5 hover:bg-brand-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-xs text-slate-400">Você ainda não criou categorias próprias.</p>
      )}

      <p className="mb-1 text-xs text-slate-400">Categorias padrão</p>
      <div className="flex flex-wrap gap-2">
        {systemCats.map((c) => (
          <span key={c.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            {c.name}
          </span>
        ))}
      </div>
    </Card>
  )
}

function TelegramCard() {
  const { data } = useTelegramStatus()
  const connect = useTelegramConnect()
  const disconnect = useTelegramDisconnect()

  if (!data?.available) return null

  return (
    <Card>
      <h3 className="mb-1 font-semibold text-slate-700">Telegram</h3>
      <p className="mb-3 text-xs text-slate-400">
        Registre gastos mandando mensagem para o bot no Telegram — ex: “mercado 89,90”.
      </p>
      {data.connected ? (
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
            <Check className="h-4 w-4" /> Conectado
          </span>
          <Button variant="secondary" onClick={() => disconnect.mutate()} loading={disconnect.isPending}>
            Desconectar
          </Button>
        </div>
      ) : (
        <Button
          loading={connect.isPending}
          onClick={async () => {
            const res = await connect.mutateAsync()
            window.open(res.url, '_blank')
          }}
        >
          Conectar Telegram
        </Button>
      )}
    </Card>
  )
}

export function Settings() {
  const { data, isLoading } = useMe()

  if (isLoading) return <Spinner />
  if (!data) return null
  const { user, accounts } = data

  return (
    <>
      <PageHeader title="Configurações" subtitle="Seu perfil e suas contas" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 font-semibold text-slate-700">Perfil</h3>
          <Row label="Nome" value={user.name ?? '—'} />
          {user.phoneNumber && <Row label="WhatsApp" value={user.phoneNumber} />}
          <Row label="E-mail" value={user.email ?? '—'} />
          <Row label="Moeda" value={user.currency} />
          <Row label="Fuso horário" value={user.timezone} />
          <Row label="Membro desde" value={formatDate(user.createdAt)} />
        </Card>

        <Card>
          <h3 className="mb-3 font-semibold text-slate-700">Contas</h3>
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">{a.name}</p>
                  <p className="text-xs text-slate-400">{ACCOUNT_TYPE[a.type] ?? a.type}</p>
                </div>
                {a.isDefault && <Badge tone="green">Principal</Badge>}
              </div>
            ))}
          </div>
        </Card>

        <PasswordCard currentEmail={user.email ?? null} />

        <TelegramCard />

        <CategoriesCard />
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Para registrar gastos, use o botão “Nova transação” na página de Transações. 💚
      </p>
    </>
  )
}
