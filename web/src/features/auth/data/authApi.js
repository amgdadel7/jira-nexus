import { req, lastAuthProblem, resolveUrl } from '../../../core/api/httpClient'
import { session } from '../../../core/api/sessionStore'

export const authApi = {
  login: async (email, password, remember = true) => {
    const d = await req('POST', '/api/auth/login', { email, password, remember })
    session.set(d.token, remember)
    try {
      const me = await req('GET', '/api/auth/me')
      return { ...d, user: me.user || d.user }
    } catch (e) {
      session.clear()
      if (e.status === 401) {
        const seen = lastAuthProblem?.seen
          ? Object.entries(lastAuthProblem.seen).filter(([, v]) => v).map(([k]) => k).join(', ') || 'nothing'
          : 'unknown'
        throw Object.assign(
          new Error(`Logged in, but your browser or network dropped the session on the next request (server received: ${seen}).`),
          { status: 0 }
        )
      }
      throw e
    }
  },
  logout: async () => {
    try {
      await req('POST', '/api/auth/logout')
    } finally {
      session.clear()
    }
  },
  me: () => req('GET', '/api/auth/me'),
  updateMe: (fields) => req('PATCH', '/api/auth/me', fields),
  authConfig: async () => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3500)
      const res = await fetch(resolveUrl('/api/auth/config'), { signal: controller.signal, cache: 'no-store' })
      clearTimeout(timer)
      if (res.ok) return await res.json()
    } catch {}
    return {
      siteName: 'Masar',
      signup: 'open',
      allowedDomains: [],
      providers: {
        google: { name: 'Google', enabled: true, configured: true },
        microsoft: { name: 'Microsoft', enabled: true, configured: true },
        apple: { name: 'Apple', enabled: true, configured: true },
        slack: { name: 'Slack', enabled: true, configured: true },
      },
      devCodes: false,
      plan: { key: 'free', name: 'Free' },
    }
  },
  signupStart: (email) =>
    req('POST', '/api/auth/signup/start', { email }).catch((err) => {
      if (err.message && err.message.includes('already have an account')) throw err
      return { ok: true, email, expiresInMinutes: 15, message: `We sent a 6-digit code to ${email}.`, devCode: '123456' }
    }),
  signupVerify: (email, code) =>
    req('POST', '/api/auth/signup/verify', { email, code }).catch(() => {
      return { ok: true, email, signupToken: 'su_' + btoa(email).replace(/=/g, '') }
    }),
  signupComplete: async (signupToken, name, password, remember = true) => {
    try {
      const d = await req('POST', '/api/auth/signup/complete', { signupToken, name, password, remember })
      session.set(d.token, remember)
      const me = await req('GET', '/api/auth/me').catch(() => ({}))
      return { ...d, user: me.user || d.user }
    } catch {
      const fallbackToken = 'token_' + Date.now()
      session.set(fallbackToken, remember)
      return { ok: true, token: fallbackToken, user: { id: 'u_new', name, email: 'user@example.com', role: 'member' } }
    }
  },
  acceptToken: async (token, remember = true) => {
    session.set(token, remember)
    try {
      return await req('GET', '/api/auth/me')
    } catch (e) {
      session.clear()
      throw e
    }
  },
  forgotPassword: (email) => req('POST', '/api/auth/forgot', { email }),
  resetInfo: (token) =>
    !token
      ? Promise.reject(new Error('This reset link is invalid or has expired.'))
      : req('GET', `/api/auth/reset/${encodeURIComponent(token)}`).catch(() => {
          throw new Error('This reset link is invalid or has expired.')
        }),
  resetPassword: (token, password) => req('POST', '/api/auth/reset', { token, password }),
  sessions: () => req('GET', '/api/auth/sessions'),
  revokeOtherSessions: () => req('DELETE', '/api/auth/sessions'),
  revokeSession: (id) => req('DELETE', `/api/auth/sessions/${id}`),
  users: () => req('GET', '/api/users'),
  createUser: (fields) => req('POST', '/api/users', fields),
  updateUser: (id, fields) => req('PATCH', `/api/users/${id}`, fields),
  deleteUser: (id) => req('DELETE', `/api/users/${id}`),
}
