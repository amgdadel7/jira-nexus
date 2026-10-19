import type { Response } from 'express'

export function sendSuccess(res: Response, data: unknown, message = 'Operation completed', status = 200) {
  res.status(status).json({ success: true, message, data })
}

export function sendFailure(res: Response, status: number, errorCode: string, message: string) {
  res.status(status).json({ success: false, errorCode, message, error: message })
}
