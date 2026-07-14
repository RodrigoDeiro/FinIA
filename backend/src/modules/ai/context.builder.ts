import { dayjs, formatInTz } from '@shared/utils/date.util.js'
import { cacheService } from '@cache/cache.service.js'
import { REDIS_KEYS, TTL } from '@config/constants.js'
import * as queryRepo from '@modules/query/query.repository.js'

// =============================================================================
// FinIA — Context Builder (memória da IA)
// =============================================================================
//
// Camada 2 da memória (§4 do ARCHITECTURE): perfil financeiro do mês, cacheado
// no Redis sob REDIS_KEYS.userCache — a MESMA chave que o transaction.service
// invalida a cada transação criada. Ou seja: o snapshot se atualiza por evento,
// exatamente como a arquitetura pede.
//
// As chaves do JSON são em português de propósito: o snapshot é injetado no
// prompt do Claude e nomes naturais reduzem ambiguidade de interpretação.
//
// =============================================================================

export interface FinancialSnapshot {
  moeda: string
  mesAtual: {
    periodo: string
    totalGastos: number
    totalReceitas: number
    saldo: number
    movimentacoes: number
    gastosPorCategoria: Array<{ categoria: string; total: number }>
  }
  mesAnterior: {
    totalGastos: number
    totalReceitas: number
  }
  ultimasTransacoes: Array<{
    data: string
    tipo: string
    valor: number
    estabelecimento: string | null
    categoria: string
    descricao: string | null
  }>
}

export async function buildFinancialSnapshot(
  userId: string,
  timezone: string,
  currency: string,
): Promise<FinancialSnapshot> {
  return cacheService.getOrSet(REDIS_KEYS.userCache(userId), TTL.USER_CACHE, async () => {
    const now = dayjs().tz(timezone)
    const currentMonth = { start: now.startOf('month').utc().toDate(), end: now.utc().toDate() }
    const prevStart = now.subtract(1, 'month').startOf('month')
    const previousMonth = {
      start: prevStart.utc().toDate(),
      end: prevStart.endOf('month').utc().toDate(),
    }

    const [expenses, income, count, breakdown, prevExpenses, prevIncome, recent] =
      await Promise.all([
        queryRepo.sumAmount(userId, 'EXPENSE', currentMonth),
        queryRepo.sumAmount(userId, 'INCOME', currentMonth),
        queryRepo.countTransactions(userId, currentMonth),
        queryRepo.expenseBreakdown(userId, currentMonth, 8),
        queryRepo.sumAmount(userId, 'EXPENSE', previousMonth),
        queryRepo.sumAmount(userId, 'INCOME', previousMonth),
        queryRepo.recentTransactions(userId, 10),
      ])

    return {
      moeda: currency,
      mesAtual: {
        periodo: now.format('MMMM [de] YYYY'),
        totalGastos: expenses,
        totalReceitas: income,
        saldo: income - expenses,
        movimentacoes: count,
        gastosPorCategoria: breakdown.map((b) => ({ categoria: b.categoryName, total: b.total })),
      },
      mesAnterior: {
        totalGastos: prevExpenses,
        totalReceitas: prevIncome,
      },
      ultimasTransacoes: recent.map((t) => ({
        data: formatInTz(t.date, timezone, 'DD/MM/YYYY'),
        tipo: t.type,
        valor: t.amount,
        estabelecimento: t.merchantName,
        categoria: t.categoryName,
        descricao: t.description,
      })),
    }
  })
}
