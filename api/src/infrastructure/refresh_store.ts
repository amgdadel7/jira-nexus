import crypto from 'node:crypto'
import { db } from './sqlite.ts'

function hashToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export function issueRefreshToken(userId: string) {
  const raw = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
  db.prepare('INSERT INTO refresh_tokens VALUES (?,?,?,?,NULL)').run(
    crypto.randomUUID(),
    userId,
    hashToken(raw),
    expiresAt,
  )
  return raw
}

export function consumeRefreshToken(raw: string) {
  const tokenHash = hashToken(raw)
  const row = db
    .prepare('SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?')
    .get(tokenHash) as { id: string; user_id: string; expires_at: string; revoked_at: string | null } | undefined
  if (!row || row.revoked_at) return undefined
  if (new Date(row.expires_at) < new Date()) return undefined
  db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), row.id)
  return row.user_id
}

export function revokeRefreshTokensForUser(userId: string) {
  db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
    new Date().toISOString(),
    userId,
  )
}
