import { MessageCircle } from 'lucide-react'

// =============================================================================
// FinIA — Login (sem senha)
// =============================================================================
//
// Não há formulário de senha: a identidade é o WhatsApp. O usuário digita
// "dashboard" no zap e recebe o magic link, que cai em /auth/magic.
//
// =============================================================================

export function Login() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-6 text-3xl font-bold text-slate-800">
          Fin<span className="text-brand-500">IA</span>
        </div>

        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
          <MessageCircle className="h-7 w-7 text-brand-600" />
        </div>

        <h1 className="mb-2 text-xl font-semibold text-slate-800">Acesse pelo WhatsApp</h1>
        <p className="mb-6 text-sm leading-relaxed text-slate-500">
          O FinIA não usa senha — seu número é a sua identidade. Envie a palavra{' '}
          <span className="font-semibold text-slate-700">dashboard</span> para o FinIA no WhatsApp e
          toque no link seguro que ele responder.
        </p>

        <div className="rounded-lg bg-slate-50 p-4 text-left text-sm text-slate-600">
          <p className="mb-1 font-medium text-slate-700">Passo a passo</p>
          <ol className="list-inside list-decimal space-y-1">
            <li>Abra a conversa com o FinIA</li>
            <li>
              Digite <span className="font-semibold">dashboard</span>
            </li>
            <li>Toque no link (válido por 15 minutos)</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
