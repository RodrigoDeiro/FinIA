import { describe, it, expect } from 'vitest'
import { buildMonthlyReportHtml } from '@modules/report/report.template.js'

// =============================================================================
// FinIA — Testes: template do relatório mensal
// =============================================================================

function baseData() {
  return {
    userName: 'Rodrigo',
    periodLabel: 'julho de 2026',
    generatedAt: new Date('2026-07-15T12:00:00Z'),
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    totalIncome: 5000,
    totalExpenses: 1234.56,
    transactionCount: 7,
    byCategory: [{ categoryName: 'Alimentação', total: 800 }],
    topMerchants: [{ merchantName: 'iFood', total: 300 }],
    transactions: [
      {
        date: new Date('2026-07-10T15:00:00Z'),
        type: 'EXPENSE' as const,
        amount: 47.9,
        merchantName: 'iFood',
        categoryName: 'Alimentação',
        description: null,
      },
    ],
  }
}

describe('buildMonthlyReportHtml', () => {
  it('contém os números e nomes do período', () => {
    const html = buildMonthlyReportHtml(baseData())
    expect(html).toContain('julho de 2026')
    expect(html).toContain('Rodrigo')
    expect(html).toContain('1.234,56') // saídas
    expect(html).toContain('5.000,00') // entradas
    expect(html).toContain('iFood')
    expect(html).toContain('Alimentação')
  })

  it('escapa HTML vindo do usuário (anti-XSS no relatório)', () => {
    const data = baseData()
    data.transactions[0].merchantName = '<script>alert(1)</script>'
    const html = buildMonthlyReportHtml(data)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('lida com período vazio', () => {
    const data = { ...baseData(), byCategory: [], topMerchants: [], transactions: [] }
    const html = buildMonthlyReportHtml(data)
    expect(html).toContain('Sem gastos no período')
    expect(html).toContain('Sem movimentações no período')
  })
})
