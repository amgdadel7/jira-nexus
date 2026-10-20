import { authEvents } from '../events/authEvents'
import { session, CLIENT_ID } from './sessionStore'

const TRANSPORT_KEY = 'jc.authTransport'
let queryTransport = (() => {
  try {
    return sessionStorage.getItem(TRANSPORT_KEY) === 'query'
  } catch {
    return false
  }
})()

export const useQueryTransport = () => {
  queryTransport = true
  try {
    sessionStorage.setItem(TRANSPORT_KEY, 'query')
  } catch {
    /* blocked */
  }
}

export const withToken = (url, token) =>
  `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`

const PUBLIC_AUTH = ['/api/auth/login', '/api/auth/reset', '/api/auth/forgot', '/api/auth/signup', '/api/auth/config', '/api/plans']
export let lastAuthProblem = null

const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '')
export const resolveUrl = (url) => {
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return url
  }
  return (API_BASE && url.startsWith('/api') ? `${API_BASE}${url}` : url)
}

export async function send(method, url, body, { raw, headers } = {}, token, viaQuery) {
  let res
  const fullUrl = resolveUrl(url)
  try {
    res = await fetch(token && viaQuery ? withToken(fullUrl, token) : fullUrl, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        ...(raw ? headers : body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}`, 'X-JC-Auth': token } : {}),
        'X-Client-Id': CLIENT_ID,
      },
      body: raw ? body : body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw Object.assign(new Error('Can’t reach the server. Check your connection and try again.'), { status: 0, network: true })
  }
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

export async function req(method, url, body, opts = {}) {
  const token = session.get()
  let { res, data } = await send(method, url, body, opts, token, queryTransport)
  const isPublic = PUBLIC_AUTH.some((p) => url.startsWith(p))

  if (res.status === 401 && token && !isPublic) {
    if (data.reason === 'no_credentials' && !queryTransport) {
      const retry = await send(method, url, body, opts, token, true)
      if (retry.res.status !== 401) {
        useQueryTransport()
        res = retry.res
        data = retry.data
      } else {
        data = retry.data
      }
    }
    if (res.status === 401) {
      lastAuthProblem = { url, reason: data.reason, seen: data.seen, at: new Date().toISOString() }
      console.warn('[auth] 401', lastAuthProblem)
      if (token === session.get()) {
        let gone = true
        if (url !== '/api/auth/me') {
          const check = await send('GET', '/api/auth/me', null, {}, token, true).catch(() => null)
          gone = !check || check.res.status === 401
          if (!gone) {
            useQueryTransport()
            ;({ res, data } = await send(method, url, body, opts, token, true))
          }
        }
        if (gone) {
          session.clear()
          if (url !== '/api/auth/me') {
            authEvents.dispatchEvent(new CustomEvent('logout', { detail: { expired: true, reason: data.reason, seen: data.seen } }))
          }
        }
      }
    }
  }

  if (!res.ok) {
    if (res.status === 402 && data.code === 'plan_limit') {
      authEvents.dispatchEvent(new CustomEvent('plan-limit', { detail: data }))
    }
    throw Object.assign(new Error(data.error || `Request failed (${res.status})`), {
      status: res.status,
      reason: data.reason,
      code: data.code,
      field: data.field,
      data,
    })
  }

  return data
}

export const q = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
  return s ? `?${s}` : ''
}
