import { req, lastAuthProblem } from '../../../core/api/httpClient'
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
  authConfig: () => req('GET', '/api/auth/config'),
  signupStart: (email) => req('POST', '/api/auth/signup/start', { email }),
  signupVerify: (email, code) => req('POST', '/api/auth/signup/verify', { email, code }),
  signupComplete: async (signupToken, name, password, remember = true) => {
    const d = await req('POST', '/api/auth/signup/complete', { signupToken, name, password, remember })
    session.set(d.token, remember)
    const me = await req('GET', '/api/auth/me')
    return { ...d, user: me.user || d.user }
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
  resetInfo: (token) => req('GET', `/api/auth/reset/${encodeURIComponent(token)}`),
  resetPassword: (token, password) => req('POST', '/api/auth/reset', { token, password }),
  sessions: () => req('GET', '/api/auth/sessions'),
  revokeOtherSessions: () => req('DELETE', '/api/auth/sessions'),
  revokeSession: (id) => req('DELETE', `/api/auth/sessions/${id}`),
  users: () => req('GET', '/api/users'),
  createUser: (fields) => req('POST', '/api/users', fields),
  updateUser: (id, fields) => req('PATCH', `/api/users/${id}`, fields),
  deleteUser: (id) => req('DELETE', `/api/users/${id}`),
}
