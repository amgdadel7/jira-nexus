import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import type { Role, User } from '../domain/entities.ts'
import type { AuthRepo, MailPort, TokenPort, UserRepo } from '../domain/ports.ts'

const ORG = 'org_acme'
const COLORS = ['#0E8F86', '#2563EB', '#C2410C', '#7C3AED']

function hashOtp(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export class AuthService {
  constructor(
    private users: UserRepo,
    private auth: AuthRepo,
    private mail: MailPort,
    private tokens: TokenPort,
  ) {}

  requestOtp(email: string, purpose: 'login' | 'signup') {
    const normalized = email.trim().toLowerCase()
    if (!normalized.includes('@')) throw new Error('Invalid email')
    if (purpose === 'login' && !this.users.getByEmail(normalized)) throw new Error('No account for this email')
    if (purpose === 'signup' && this.users.getByEmail(normalized)) throw new Error('Account already exists')
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    this.auth.saveOtp(normalized, hashOtp(code), purpose, expires)
    this.mail.send(
      normalized,
      `Nexus ${purpose} code`,
      `Your one-time code is ${code}. It expires in 10 minutes.`,
      `<p>Your one-time code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
    )
    const preview = process.env.MAIL_DRIVER === 'smtp' ? undefined : code
    return { email: normalized, expiresAt: expires, previewCode: preview }
  }

  verifyOtp(email: string, code: string, purpose: 'login' | 'signup') {
    const normalized = email.trim().toLowerCase()
    const row = this.auth.consumeOtp(normalized, purpose)
    if (!row) throw new Error('No code requested')
    if (new Date(row.expiresAt) < new Date()) throw new Error('Code expired')
    if (row.codeHash !== hashOtp(code.trim())) throw new Error('Invalid code')
    return normalized
  }

  completeSignup(email: string, name: string, password: string, inviteRole?: Role) {
    const existing = this.users.getByEmail(email)
    if (existing) throw new Error('Account already exists')
    const user: User = {
      id: crypto.randomUUID(),
      organizationId: ORG,
      email,
      name: name.trim() || email.split('@')[0]!,
      role: inviteRole ?? 'developer',
      title: 'Member',
      department: 'Engineering',
      skills: [],
      capacity: 40,
      workload: 0,
      presence: 'active',
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      joinedAt: new Date().toISOString(),
      emailVerified: true,
    }
    this.users.save(user, bcrypt.hashSync(password, 10))
    return this.tokens.sign(user)
  }

  loginPassword(email: string, password: string) {
    const user = this.users.getByEmail(email.trim().toLowerCase())
    if (!user) throw new Error('Invalid credentials')
    const hash = this.users.passwordHash(user.id)
    if (!hash || !bcrypt.compareSync(password, hash)) throw new Error('Invalid credentials')
    return { user, ...this.tokens.sign(user) }
  }

  loginOtp(email: string) {
    const user = this.users.getByEmail(email)
    if (!user) throw new Error('No account for this email')
    return { user, ...this.tokens.sign(user) }
  }

  upsertOauth(profile: { email: string; name: string; sub: string; provider: 'google' | 'microsoft' }) {
    let user =
      profile.provider === 'google'
        ? this.users.getByGoogleSub(profile.sub)
        : this.users.getByMicrosoftSub(profile.sub)
    if (!user) user = this.users.getByEmail(profile.email)
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        organizationId: ORG,
        email: profile.email.toLowerCase(),
        name: profile.name,
        role: 'developer',
        title: 'Member',
        department: 'Engineering',
        skills: [],
        capacity: 40,
        workload: 0,
        presence: 'active',
        color: COLORS[0]!,
        joinedAt: new Date().toISOString(),
        emailVerified: true,
        googleSub: profile.provider === 'google' ? profile.sub : undefined,
        microsoftSub: profile.provider === 'microsoft' ? profile.sub : undefined,
      }
    } else {
      if (profile.provider === 'google') user.googleSub = profile.sub
      else user.microsoftSub = profile.sub
      user.emailVerified = true
    }
    this.users.save(user)
    return { user, ...this.tokens.sign(user) }
  }

  invite(email: string, role: Role, inviter: User) {
    const token = crypto.randomBytes(24).toString('hex')
    const tokenHash = hashOtp(token)
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
    this.auth.saveInvite(tokenHash, email.trim().toLowerCase(), role, inviter.id, expiresAt)
    const origin = process.env.WEB_ORIGIN ?? 'http://localhost:5173'
    const link = `${origin}/invite/${token}`
    this.mail.send(
      email.trim().toLowerCase(),
      `${inviter.name} invited you to Nexus`,
      `Join Acme Digital on Nexus: ${link}`,
      `<p>${inviter.name} invited you to Nexus.</p><p><a href="${link}">Accept invitation</a></p>`,
    )
    return { email: email.trim().toLowerCase(), expiresAt, inviteUrl: link }
  }

  readInvite(token: string) {
    const row = this.auth.getInvite(hashOtp(token))
    if (!row) throw new Error('Invitation not found')
    if (new Date(row.expiresAt) < new Date()) throw new Error('Invitation expired')
    return row
  }

  consumeInvite(token: string) {
    this.auth.consumeInvite(hashOtp(token))
  }
}
