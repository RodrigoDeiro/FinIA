// =============================================================================
// FinIA — Cliente HTTP
// =============================================================================
//
// fetch com credentials:'include' (cookies httpOnly de sessão). Em um 401, tenta
// UMA rotação de refresh (/auth/refresh) e refaz a chamada; se ainda falhar,
// dispara 'finia:unauthorized' (o ProtectedRoute redireciona para o login).
//
// Same-origin em dev graças ao proxy do Vite (/api → :3000).
//
// =============================================================================

const BASE = '/api/v1'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function emitUnauthorized(): void {
  window.dispatchEvent(new CustomEvent('finia:unauthorized'))
}

let refreshing: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  // Coalesce: várias 401 concorrentes disparam UM único refresh
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        // libera para o próximo ciclo depois que todos leem o resultado
        setTimeout(() => (refreshing = null), 0)
      })
  }
  return refreshing
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** não tentar refresh (usado pelas próprias rotas de auth) */
  noRetry?: boolean
}

async function raw(path: string, opts: RequestOptions): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await raw(path, opts)

  if (res.status === 401 && !opts.noRetry) {
    const ok = await tryRefresh()
    if (ok) {
      res = await raw(path, opts)
    } else {
      emitUnauthorized()
      throw new ApiError(401, 'UNAUTHORIZED', 'Sessão expirada')
    }
  }

  if (res.status === 401) {
    emitUnauthorized()
    throw new ApiError(401, 'UNAUTHORIZED', 'Sessão expirada')
  }

  if (res.status === 204) return undefined as T

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const payload: unknown = isJson ? await res.json() : await res.text()

  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string } }).error
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? 'Erro na requisição')
  }

  return payload as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  /** POST sem retry — para /auth/magic e /auth/refresh */
  authPost: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body, noRetry: true }),
}
