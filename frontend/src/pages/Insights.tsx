import { Lightbulb, Sparkles, RefreshCw, X } from 'lucide-react'
import { PageHeader } from '@/components/Layout'
import { Button, Card, Spinner, EmptyState, Badge } from '@/components/ui'
import { useInsights, useGenerateInsights, useDismissInsight } from '@/hooks/useApi'
import { fromNow } from '@/lib/format'

export function Insights() {
  const { data: insights, isLoading } = useInsights()
  const generate = useGenerateInsights()
  const dismiss = useDismissInsight()

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle="Padrões e alertas das suas finanças"
        action={
          <Button variant="secondary" onClick={() => generate.mutate()} loading={generate.isPending}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        }
      />

      {generate.isSuccess && (
        <p className="mb-4 rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
          Gerando novos insights… eles aparecem aqui em instantes.
        </p>
      )}

      {isLoading ? (
        <Spinner />
      ) : !insights || insights.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Lightbulb className="h-8 w-8" />}
            title="Nenhum insight ainda"
            hint="Registre algumas movimentações e clique em Atualizar."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {insights.map((i) => (
            <Card key={i.id} className={i.seenAt ? '' : 'border-brand-200 bg-brand-50/30'}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{i.title}</h3>
                    {i.aiGenerated && (
                      <Badge tone="blue">
                        <Sparkles className="mr-0.5 inline h-3 w-3" /> IA
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">{i.body}</p>
                  <p className="mt-2 text-xs text-slate-400">{fromNow(i.createdAt)}</p>
                </div>
                <button
                  onClick={() => dismiss.mutate(i.id)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                  title="Dispensar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
