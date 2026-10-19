import type express from 'express'
import { users } from '../infrastructure/sqlite.ts'
import { tokens } from '../infrastructure/tokens.ts'
import { sendFailure } from './http_response.ts'

export function readCurrentUser(req: express.Request) {
  const header = req.headers.authorization
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  const token = bearer || (req.cookies?.nexus_token as string | undefined)
  if (!token) return undefined
  const payload = tokens.verify(token)
  if (!payload) return undefined
  return users.getById(payload.userId)
}

export type AuthedRequest = express.Request & { user: NonNullable<ReturnType<typeof readCurrentUser>> }

export function requireUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = readCurrentUser(req)
  if (!user) return sendFailure(res, 401, 'UNAUTHORIZED', 'Unauthorized')
  ;(req as AuthedRequest).user = user
  next()
}

export function asAuthed(req: express.Request) {
  return req as AuthedRequest
}

export function isOauthLive(provider: 'google' | 'microsoft') {
  if (provider === 'google') return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
}
