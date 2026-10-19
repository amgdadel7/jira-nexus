import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import type { Role } from '../domain/entities.ts'
import { AuthService } from '../application/auth.ts'
import { users, authStore } from '../infrastructure/sqlite.ts'
import { mail } from '../infrastructure/email.ts'
import { tokens } from '../infrastructure/tokens.ts'
import { consumeRefreshToken, revokeRefreshTokensForUser } from '../infrastructure/refresh_store.ts'
import { sendFailure, sendSuccess } from './http_response.ts'
import { asAuthed, requireUser } from './http_context.ts'
import { createAuthOauthRouter } from './auth_oauth_routes.ts'
import { withRefresh } from './session_tokens.ts'

const auth = new AuthService(users, authStore, mail, tokens)

export function createAuthRouter() {
  const router = Router()
  router.use(createAuthOauthRouter())

  router.post('/otp/request', (req, res) => {
    const parsed = z.object({ email: z.string().email(), purpose: z.enum(['login', 'signup']) }).safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    try {
      sendSuccess(res, auth.requestOtp(parsed.data.email, parsed.data.purpose))
    } catch (e) {
      sendFailure(res, 400, 'OTP_REQUEST_FAILED', (e as Error).message)
    }
  })

  router.post('/otp/verify', (req, res) => {
    const parsed = z
      .object({
        email: z.string().email(),
        code: z.string().min(4),
        purpose: z.enum(['login', 'signup']),
        name: z.string().optional(),
        password: z.string().optional(),
        inviteToken: z.string().optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    try {
      const email = auth.verifyOtp(parsed.data.email, parsed.data.code, parsed.data.purpose)
      if (parsed.data.purpose === 'signup') {
        let role: Role | undefined
        if (parsed.data.inviteToken) {
          const inv = auth.readInvite(parsed.data.inviteToken)
          role = inv.role as Role
          auth.consumeInvite(parsed.data.inviteToken)
        }
        const password = parsed.data.password ?? crypto.randomUUID()
        const signed = auth.completeSignup(email, parsed.data.name ?? email, password, role)
        const user = users.getByEmail(email)!
        return sendSuccess(res, withRefresh(user.id, { user, ...signed }))
      }
      const result = auth.loginOtp(email)
      sendSuccess(res, withRefresh(result.user.id, result))
    } catch (e) {
      sendFailure(res, 400, 'OTP_VERIFY_FAILED', (e as Error).message)
    }
  })

  router.post('/login', (req, res) => {
    const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    try {
      const result = auth.loginPassword(parsed.data.email, parsed.data.password)
      sendSuccess(res, withRefresh(result.user.id, result))
    } catch (e) {
      sendFailure(res, 401, 'INVALID_CREDENTIALS', (e as Error).message)
    }
  })

  router.post('/register', (req, res) => {
    const parsed = z
      .object({ email: z.string().email(), password: z.string().min(6), name: z.string().min(1) })
      .safeParse(req.body)
    if (!parsed.success) {
      return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Enter your name, a valid email, and a password of at least 6 characters.')
    }
    try {
      const email = parsed.data.email.trim().toLowerCase()
      const signed = auth.completeSignup(email, parsed.data.name, parsed.data.password)
      const user = users.getByEmail(email)!
      sendSuccess(res, withRefresh(user.id, { user, ...signed }))
    } catch (e) {
      sendFailure(res, 400, 'REGISTER_FAILED', (e as Error).message)
    }
  })

  router.post('/refresh', (req, res) => {
    const parsed = z.object({ refreshToken: z.string().min(10) }).safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    const userId = consumeRefreshToken(parsed.data.refreshToken)
    if (!userId) return sendFailure(res, 401, 'REFRESH_INVALID', 'Refresh token is invalid or expired')
    const user = users.getById(userId)
    if (!user) return sendFailure(res, 401, 'REFRESH_INVALID', 'Refresh token is invalid or expired')
    sendSuccess(res, withRefresh(user.id, { user, ...tokens.sign(user) }))
  })

  router.post('/logout', requireUser, (req, res) => {
    revokeRefreshTokensForUser(asAuthed(req).user.id)
    sendSuccess(res, { ok: true })
  })

  return router
}
