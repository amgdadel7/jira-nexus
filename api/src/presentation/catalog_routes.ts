import { Router } from 'express'
import { z } from 'zod'
import type { Role } from '../domain/entities.ts'
import { AuthService } from '../application/auth.ts'
import { WorkspaceService } from '../application/workspace.ts'
import { users, workspace, authStore } from '../infrastructure/sqlite.ts'
import { mail } from '../infrastructure/email.ts'
import { tokens } from '../infrastructure/tokens.ts'
import { sendFailure, sendSuccess } from './http_response.ts'
import { asAuthed, requireUser } from './http_context.ts'

const auth = new AuthService(users, authStore, mail, tokens)
const work = new WorkspaceService(workspace, users)

export function createCatalogRouter() {
  const router = Router()

  router.get('/me', requireUser, (req, res) => {
    sendSuccess(res, asAuthed(req).user)
  })

  router.get('/mailbox', requireUser, (req, res) => {
    const user = asAuthed(req).user
    const all = user.role === 'org_admin' || user.role === 'super_admin'
    sendSuccess(res, mail.list(all ? undefined : user.email))
  })

  router.post('/invites', requireUser, (req, res) => {
    const parsed = z.object({ email: z.string().email(), role: z.string().default('developer') }).safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    try {
      sendSuccess(res, auth.invite(parsed.data.email, parsed.data.role as Role, asAuthed(req).user))
    } catch (e) {
      sendFailure(res, 400, 'INVITE_FAILED', (e as Error).message)
    }
  })

  router.get('/invites/:token', (req, res) => {
    try {
      sendSuccess(res, auth.readInvite(req.params.token))
    } catch (e) {
      sendFailure(res, 404, 'INVITE_NOT_FOUND', (e as Error).message)
    }
  })

  router.get('/organization', requireUser, (_req, res) => {
    sendSuccess(res, { id: 'org_acme', name: 'Acme Digital', slug: 'acme', plan: 'Enterprise' })
  })

  router.get('/users', requireUser, (_req, res) => sendSuccess(res, users.list()))

  router.get('/search', requireUser, (req, res) => {
    sendSuccess(res, work.search(String(req.query.q ?? '')))
  })

  router.get('/comments', requireUser, (req, res) => {
    sendSuccess(res, workspace.listComments(req.query.issueId as string | undefined))
  })

  router.get('/activities', requireUser, (_req, res) => sendSuccess(res, workspace.listActivities()))

  router.get('/notifications', requireUser, (req, res) => {
    sendSuccess(res, workspace.listNotifications(asAuthed(req).user.id))
  })

  router.post('/notifications/:id/read', requireUser, (req, res) => {
    workspace.markNotificationRead(String(req.params.id), asAuthed(req).user.id)
    sendSuccess(res, { ok: true })
  })

  router.get('/reports/velocity', requireUser, (_req, res) => sendSuccess(res, work.velocity()))
  router.get('/reports/cycle', requireUser, (_req, res) => sendSuccess(res, work.cycle()))

  return router
}
