import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const apiBase = apiOrigin ? `${apiOrigin}/api` : '/api'

export const api = axios.create({
  baseURL: apiBase,
  timeout: 20000,
})

const raw = axios.create({
  baseURL: apiBase,
  timeout: 20000,
})

export function getApiEndpoint(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${apiBase}${clean}`
}

function readToken() {
  try {
    const rawToken = localStorage.getItem('nexus-access')
    if (rawToken) return rawToken
    const session = localStorage.getItem('nexus-session')
    if (!session) return null
    const parsed = JSON.parse(session) as { state?: { token?: string } }
    return parsed.state?.token ?? null
  } catch {
    return null
  }
}

function readRefresh() {
  try {
    return localStorage.getItem('nexus-refresh')
  } catch {
    return null
  }
}

function persistTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem('nexus-access', accessToken)
  if (refreshToken) localStorage.setItem('nexus-refresh', refreshToken)
}

function clearTokens() {
  localStorage.removeItem('nexus-access')
  localStorage.removeItem('nexus-refresh')
}

type Envelope<T> = { success: boolean; data?: T; message?: string; error?: string; errorCode?: string }

function unwrapBody<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in body) {
    const env = body as Envelope<T>
    if (env.success === false) {
      const err = new Error(env.message || env.error || 'Request failed')
      throw err
    }
    return env.data as T
  }
  return body as T
}

let refreshInFlight: Promise<string | null> | null = null

async function rotateAccess(): Promise<string | null> {
  const refreshToken = readRefresh()
  if (!refreshToken) return null
  if (!refreshInFlight) {
    refreshInFlight = raw
      .post<Envelope<{ accessToken: string; refreshToken: string }>>('/auth/refresh', { refreshToken })
      .then((res) => {
        const data = unwrapBody<{ accessToken: string; refreshToken: string }>(res.data)
        persistTokens(data.accessToken, data.refreshToken)
        return data.accessToken
      })
      .catch(() => {
        clearTokens()
        return null
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

function skipRefresh(url: string) {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/otp') ||
    url.includes('/auth/providers') ||
    url.includes('/auth/oauth')
  )
}

api.interceptors.request.use((config) => {
  const token = readToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => {
    if (res.data && typeof res.data === 'object') {
      if ('success' in res.data) {
        const env = res.data as Envelope<unknown>
        if (env.success === false) {
          const msg = env.message || env.error || 'Request failed'
          return Promise.reject(Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { response: res }))
        }
        res.data = env.data
      } else if ('code' in res.data && 'message' in res.data) {
        const errObj = res.data as { code: unknown; message: unknown }
        const msg = typeof errObj.message === 'string' ? errObj.message : String(errObj.code)
        return Promise.reject(Object.assign(new Error(msg), { response: res, code: String(errObj.code) }))
      } else if ('error' in res.data && !('data' in res.data)) {
        const errVal = (res.data as { error: unknown }).error
        const msg = typeof errVal === 'string' ? errVal : typeof errVal === 'object' && errVal !== null && 'message' in errVal ? String((errVal as { message: unknown }).message) : 'Request failed'
        return Promise.reject(Object.assign(new Error(msg), { response: res }))
      }
    }
    return res
  },
  async (err: AxiosError) => {
    const status = err.response?.status
    const config = err.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
    const url = String(config?.url ?? '')
    if (status === 401 && config && !config._retried && !skipRefresh(url)) {
      config._retried = true
      const next = await rotateAccess()
      if (next) {
        config.headers.Authorization = `Bearer ${next}`
        return api.request(config)
      }
      if (url.includes('/me')) clearTokens()
    }
    return Promise.reject(err)
  },
)

export { persistTokens, clearTokens, readRefresh }
