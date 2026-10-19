import { Router } from 'express'
import { z } from 'zod'
import { AuthService } from '../application/auth.ts'
import { users, authStore } from '../infrastructure/sqlite.ts'
import { mail } from '../infrastructure/email.ts'
import { tokens } from '../infrastructure/tokens.ts'
import { sendFailure, sendSuccess } from './http_response.ts'
import { isOauthLive } from './http_context.ts'
import { withRefresh } from './session_tokens.ts'

const WEB = process.env.WEB_ORIGIN ?? 'http://localhost:5173'
const API = process.env.API_PUBLIC ?? 'http://127.0.0.1:8080'
const auth = new AuthService(users, authStore, mail, tokens)

export function createAuthOauthRouter() {
  const router = Router()

  router.get('/providers', (_req, res) => {
    sendSuccess(res, {
      google: true,
      microsoft: true,
      googleLive: isOauthLive('google'),
      microsoftLive: isOauthLive('microsoft'),
    })
  })

  router.get('/oauth/accounts', (_req, res) => {
    const all = users.list()
    const admin = all.find((u) => u.id === 'usr_001')
    const rest = all.filter((u) => u.id !== 'usr_001').slice(0, 7)
    const picked = admin ? [admin, ...rest] : rest
    sendSuccess(
      res,
      picked.map((u) => ({ email: u.email, name: u.name, color: u.color, title: u.title })),
    )
  })

  router.post('/oauth/complete', (req, res) => {
    const parsed = z
      .object({
        provider: z.enum(['google', 'microsoft']),
        email: z.string().email(),
        name: z.string().min(1).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    try {
      const email = parsed.data.email.trim().toLowerCase()
      const existing = users.getByEmail(email)
      const name = parsed.data.name?.trim() || existing?.name || email.split('@')[0]!
      const result = auth.upsertOauth({
        email,
        name,
        sub: `demo:${parsed.data.provider}:${email}`,
        provider: parsed.data.provider,
      })
      sendSuccess(res, withRefresh(result.user.id, result))
    } catch (e) {
      sendFailure(res, 400, 'OAUTH_FAILED', (e as Error).message)
    }
  })

  router.get('/google', (req, res) => {
    if (!isOauthLive('google')) {
      return res.redirect(`${WEB}/auth/oauth?provider=google&state=${encodeURIComponent(String(req.query.state ?? 'login'))}`)
    }
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
    url.searchParams.set('redirect_uri', `${API}/api/auth/google/callback`)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('state', String(req.query.state ?? 'login'))
    res.redirect(url.toString())
  })

  router.get('/google/callback', async (req, res) => {
    try {
      const code = String(req.query.code ?? '')
      const body = new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${API}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      })
      const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body })
      const json = (await tok.json()) as { access_token?: string }
      if (!json.access_token) throw new Error('Google token exchange failed')
      const me = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${json.access_token}` },
      })
      const profile = (await me.json()) as { sub: string; email: string; name: string }
      const result = auth.upsertOauth({ email: profile.email, name: profile.name, sub: profile.sub, provider: 'google' })
      res.redirect(`${WEB}/auth/callback?token=${encodeURIComponent(result.accessToken)}`)
    } catch (e) {
      res.redirect(`${WEB}/login?error=${encodeURIComponent((e as Error).message)}`)
    }
  })

  router.get('/microsoft', (req, res) => {
    if (!isOauthLive('microsoft')) {
      return res.redirect(`${WEB}/auth/oauth?provider=microsoft&state=${encodeURIComponent(String(req.query.state ?? 'login'))}`)
    }
    const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    url.searchParams.set('client_id', process.env.MICROSOFT_CLIENT_ID!)
    url.searchParams.set('redirect_uri', `${API}/api/auth/microsoft/callback`)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('response_mode', 'query')
    url.searchParams.set('scope', 'openid email profile User.Read')
    url.searchParams.set('state', String(req.query.state ?? 'login'))
    res.redirect(url.toString())
  })

  router.get('/microsoft/callback', async (req, res) => {
    try {
      const code = String(req.query.code ?? '')
      const body = new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: `${API}/api/auth/microsoft/callback`,
        grant_type: 'authorization_code',
      })
      const tok = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', { method: 'POST', body })
      const json = (await tok.json()) as { access_token?: string }
      if (!json.access_token) throw new Error('Microsoft token exchange failed')
      const me = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${json.access_token}` },
      })
      const profile = (await me.json()) as { id: string; mail?: string; userPrincipalName?: string; displayName: string }
      const email = profile.mail || profile.userPrincipalName
      if (!email) throw new Error('Microsoft profile has no email')
      const result = auth.upsertOauth({ email, name: profile.displayName, sub: profile.id, provider: 'microsoft' })
      res.redirect(`${WEB}/auth/callback?token=${encodeURIComponent(result.accessToken)}`)
    } catch (e) {
      res.redirect(`${WEB}/login?error=${encodeURIComponent((e as Error).message)}`)
    }
  })

  return router
}
