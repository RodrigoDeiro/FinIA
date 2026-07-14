import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Não insistir em 401 (sessão) nem 4xx — só erros transitórios
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
    },
  },
})
