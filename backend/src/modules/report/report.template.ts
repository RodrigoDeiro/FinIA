import { formatBRL } from '@shared/utils/currency.util.js'
import { formatInTz } from '@shared/utils/date.util.js'
import type { CategoryTotal, MerchantTotal, RecentTransaction } from '@modules/query/query.repository.js'

// =============================================================================
// FinIA — Template do relatório mensal (HTML autocontido)
// =============================================================================
//
// HTML com CSS inline, sem dependências externas: abre em qualquer navegador
// e imprime bem (Ctrl+P → PDF). Decisão conservadora (§13): geração de PDF
// server-side via Puppeteer fica como evolução futura — o formato 'html' já é
// suportado pelo schema e cobre o caso de uso.
//
// Segurança: TODO texto vindo do usuário passa por escapeHtml (descrições e
// merchants podem conter qualquer coisa digitada no WhatsApp).
//
// =============================================================================

export interface MonthlyReportData {
  userName: string | null
  periodLabel: string
  generatedAt: Date
  timezone: string
  currency: string
  totalIncome: number
  totalExpenses: number
  transactionCount: number
  byCategory: CategoryTotal[]
  topMerchants: MerchantTotal[]
  transactions: RecentTransaction[]
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const TYPE_LABEL: Record<string, string> = {
  EXPENSE: 'Gasto',
  INCOME: 'Receita',
  INVESTMENT: 'Investimento',
  TRANSFER: 'Transferência',
  DEBT: 'Dívida',
}

export function buildMonthlyReportHtml(d: MonthlyReportData): string {
  const balance = d.totalIncome - d.totalExpenses
  const money = (v: number): string => formatBRL(v, d.currency)

  const categoryRows = d.byCategory
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.categoryName)}</td><td class="num">${money(c.total)}</td></tr>`,
    )
    .join('\n')

  const merchantRows = d.topMerchants
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.merchantName)}</td><td class="num">${money(m.total)}</td></tr>`,
    )
    .join('\n')

  const txRows = d.transactions
    .map((t) => {
      const label = t.merchantName ?? t.description ?? '—'
      return (
        `<tr><td>${formatInTz(t.date, d.timezone, 'DD/MM')}</td>` +
        `<td>${TYPE_LABEL[t.type] ?? t.type}</td>` +
        `<td>${escapeHtml(label)}</td>` +
        `<td>${escapeHtml(t.categoryName)}</td>` +
        `<td class="num">${money(t.amount)}</td></tr>`
      )
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>FinIA — Relatório ${escapeHtml(d.periodLabel)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 32px; color: #1a1a1a; background: #fafafa; }
  .wrap { max-width: 860px; margin: 0 auto; }
  header { border-bottom: 3px solid #10B981; padding-bottom: 16px; margin-bottom: 24px; }
  h1 { margin: 0; font-size: 24px; } h1 span { color: #10B981; }
  .meta { color: #666; font-size: 13px; margin-top: 4px; }
  .cards { display: flex; gap: 16px; margin: 24px 0; flex-wrap: wrap; }
  .card { flex: 1; min-width: 160px; background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 16px; }
  .card .label { font-size: 12px; text-transform: uppercase; color: #888; letter-spacing: .04em; }
  .card .value { font-size: 22px; font-weight: 700; margin-top: 6px; }
  .pos { color: #10B981; } .neg { color: #EF4444; }
  h2 { font-size: 16px; margin: 28px 0 10px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; overflow: hidden; }
  th { text-align: left; font-size: 12px; text-transform: uppercase; color: #888; padding: 10px 12px; background: #f4f4f4; }
  td { padding: 10px 12px; border-top: 1px solid #f0f0f0; font-size: 14px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  footer { margin-top: 32px; color: #999; font-size: 12px; text-align: center; }
  @media print { body { background: #fff; padding: 0; } }
</style>
</head>
<body><div class="wrap">
<header>
  <h1>Fin<span>IA</span> — Relatório mensal</h1>
  <div class="meta">${escapeHtml(d.periodLabel)}${d.userName ? ` · ${escapeHtml(d.userName)}` : ''} · gerado em ${formatInTz(d.generatedAt, d.timezone)}</div>
</header>

<div class="cards">
  <div class="card"><div class="label">Entradas</div><div class="value pos">${money(d.totalIncome)}</div></div>
  <div class="card"><div class="label">Saídas</div><div class="value neg">${money(d.totalExpenses)}</div></div>
  <div class="card"><div class="label">Saldo</div><div class="value ${balance >= 0 ? 'pos' : 'neg'}">${money(balance)}</div></div>
  <div class="card"><div class="label">Movimentações</div><div class="value">${d.transactionCount}</div></div>
</div>

<h2>Gastos por categoria</h2>
<table><thead><tr><th>Categoria</th><th class="num">Total</th></tr></thead>
<tbody>${categoryRows || '<tr><td colspan="2">Sem gastos no período</td></tr>'}</tbody></table>

<h2>Principais estabelecimentos</h2>
<table><thead><tr><th>Estabelecimento</th><th class="num">Total</th></tr></thead>
<tbody>${merchantRows || '<tr><td colspan="2">Sem estabelecimentos identificados</td></tr>'}</tbody></table>

<h2>Movimentações (${d.transactions.length})</h2>
<table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th></tr></thead>
<tbody>${txRows || '<tr><td colspan="5">Sem movimentações no período</td></tr>'}</tbody></table>

<footer>FinIA — assistente financeiro pessoal · relatório gerado automaticamente</footer>
</div></body></html>`
}
