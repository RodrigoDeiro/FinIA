import { PageHeader } from '@/components/Layout'
import { Card, Spinner, Badge } from '@/components/ui'
import { useMe } from '@/hooks/useApi'
import { formatDate } from '@/lib/format'

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
          <Row label="WhatsApp" value={user.phoneNumber} />
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
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Para registrar gastos, é só mandar mensagem para o FinIA no WhatsApp. 💚
      </p>
    </>
  )
}
