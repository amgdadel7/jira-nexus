import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { createAuthRouter } from './auth_routes.ts'
import { createCatalogRouter } from './catalog_routes.ts'
import { createWorkRouter } from './work_routes.ts'
import { sendFailure, sendSuccess } from './http_response.ts'

export function createApp() {
  const app = express()
  app.use(cors({ origin: true, credentials: true }))
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  app.get('/api/health', (_req, res) => sendSuccess(res, { ok: true }))
  app.use('/api/auth', createAuthRouter())
  app.use('/api', createCatalogRouter())
  app.use('/api', createWorkRouter())

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err)
    sendFailure(res, 500, 'SERVER_ERROR', err.message || 'Server error')
  })

  return app
}
