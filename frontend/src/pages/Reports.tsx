import { FileText, Download, Plus, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/Layout'
import { Button, Card, Spinner, EmptyState, Badge } from '@/components/ui'
import { useReports, useCreateReport } from '@/hooks/useApi'
import { formatDate, formatDateTime } from '@/lib/format'
import type { Report } from '@/types/api'

const STATUS: Record<Report['status'], { tone: 'green' | 'amber' | 'red' | 'slate'; label: string }> = {
  COMPLETED: { tone: 'green', label: 'Pronto' },
  GENERATING: { tone: 'amber', label: 'Gerando…' },
  PENDING: { tone: 'slate', label: 'Na fila' },
  FAILED: { tone: 'red', label: 'Falhou' },
}

export function Reports() {
  const { data: reports, isLoading } = useReports()
  const create = useCreateReport()

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Relatório mensal em HTML (imprime em PDF pelo navegador)"
        action={
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            <Plus className="h-4 w-4" /> Gerar do mês
          </Button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : !reports || reports.length === 0 ? (
        <Card>
          <EmptyState icon={<FileText className="h-8 w-8" />} title="Nenhum relatório" hint="Gere o relatório do mês atual." />
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-slate-100">
            {reports.map((r) => {
              const st = STATUS[r.status]
              const processing = r.status === 'PENDING' || r.status === 'GENERATING'
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                      {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">
                        Relatório de {formatDate(r.periodStart, 'MMMM/YYYY')}
                      </p>
                      <p className="truncate text-xs text-slate-400">Criado em {formatDateTime(r.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {r.status === 'COMPLETED' && (
                      <a
                        href={`/api/v1/reports/${r.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="h-4 w-4" /> Baixar
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </>
  )
}
