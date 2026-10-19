import { issueRefreshToken } from '../infrastructure/refresh_store.ts'

export function withRefresh(userId: string, payload: { user: unknown; accessToken: string; expiresIn: number }) {
  return { ...payload, refreshToken: issueRefreshToken(userId) }
}
