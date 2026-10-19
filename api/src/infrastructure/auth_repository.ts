import type { AuthRepo } from '../domain/ports.ts'
import { db } from './sqlite_database.ts'

export const authStore: AuthRepo = {
  saveOtp(email, codeHash, purpose, expiresAt) {
    db.prepare('INSERT OR REPLACE INTO otps (email, purpose, code_hash, expires_at) VALUES (?,?,?,?)').run(
      email.toLowerCase(),
      purpose,
      codeHash,
      expiresAt,
    )
  },
  consumeOtp(email, purpose) {
    const row = db
      .prepare('SELECT code_hash, expires_at FROM otps WHERE email = ? AND purpose = ?')
      .get(email.toLowerCase(), purpose) as { code_hash: string; expires_at: string } | undefined
    if (row) db.prepare('DELETE FROM otps WHERE email = ? AND purpose = ?').run(email.toLowerCase(), purpose)
    return row ? { codeHash: row.code_hash, expiresAt: row.expires_at } : undefined
  },
  saveInvite(tokenHash, email, role, inviterId, expiresAt) {
    db.prepare('INSERT INTO invites (token_hash, email, role, inviter_id, expires_at, consumed) VALUES (?,?,?,?,?,0)').run(
      tokenHash,
      email.toLowerCase(),
      role,
      inviterId,
      expiresAt,
    )
  },
  getInvite(tokenHash) {
    const row = db
      .prepare('SELECT email, role, expires_at FROM invites WHERE token_hash = ? AND consumed = 0')
      .get(tokenHash) as { email: string; role: string; expires_at: string } | undefined
    return row ? { email: row.email, role: row.role, expiresAt: row.expires_at } : undefined
  },
  consumeInvite(tokenHash) {
    db.prepare('UPDATE invites SET consumed = 1 WHERE token_hash = ?').run(tokenHash)
  },
}
