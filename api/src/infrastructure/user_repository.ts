import type { UserRepo } from '../domain/ports.ts'
import { db } from './sqlite_database.ts'
import { USER_COLUMNS, mapUserRow } from './sqlite_row_mappers.ts'

export const users: UserRepo = {
  getById(id) {
    const row = db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) as Record<string, unknown> | undefined
    return row ? mapUserRow(row) : undefined
  },
  getByEmail(email) {
    const row = db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = lower(?)`).get(email) as
      | Record<string, unknown>
      | undefined
    return row ? mapUserRow(row) : undefined
  },
  getByGoogleSub(sub) {
    const row = db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE google_sub = ?`).get(sub) as Record<string, unknown> | undefined
    return row ? mapUserRow(row) : undefined
  },
  getByMicrosoftSub(sub) {
    const row = db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE microsoft_sub = ?`).get(sub) as Record<string, unknown> | undefined
    return row ? mapUserRow(row) : undefined
  },
  list() {
    return (db.prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY name`).all() as Record<string, unknown>[]).map(mapUserRow)
  },
  save(user, passwordHash) {
    db.prepare(
      `INSERT INTO users (id, organization_id, email, password_hash, name, role, title, department, skills, capacity, workload, presence, color, joined_at, email_verified, google_sub, microsoft_sub)
       VALUES (@id,@organization_id,@email,@password_hash,@name,@role,@title,@department,@skills,@capacity,@workload,@presence,@color,@joined_at,@email_verified,@google_sub,@microsoft_sub)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, role=excluded.role, title=excluded.title, department=excluded.department,
         skills=excluded.skills, capacity=excluded.capacity, workload=excluded.workload, presence=excluded.presence,
         email_verified=excluded.email_verified, google_sub=excluded.google_sub, microsoft_sub=excluded.microsoft_sub,
         password_hash=COALESCE(excluded.password_hash, users.password_hash)`,
    ).run({
      id: user.id,
      organization_id: user.organizationId,
      email: user.email.toLowerCase(),
      password_hash: passwordHash ?? null,
      name: user.name,
      role: user.role,
      title: user.title,
      department: user.department,
      skills: JSON.stringify(user.skills),
      capacity: user.capacity,
      workload: user.workload,
      presence: user.presence,
      color: user.color,
      joined_at: user.joinedAt,
      email_verified: user.emailVerified ? 1 : 0,
      google_sub: user.googleSub ?? null,
      microsoft_sub: user.microsoftSub ?? null,
    })
  },
  passwordHash(id) {
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id) as { password_hash?: string } | undefined
    return row?.password_hash
  },
}

export function isEmpty() {
  const row = db.prepare('SELECT COUNT(id) AS c FROM users').get() as { c: number }
  return row.c === 0
}
