import jwt from 'jsonwebtoken'
import type { TokenPort } from '../domain/ports.ts'
import type { User } from '../domain/entities.ts'

const SECRET = process.env.JWT_SECRET ?? 'nexus-dev-change-me-32-chars-min!!'

export const tokens: TokenPort = {
  sign(user) {
    const expiresIn = 60 * 60 * 12
    const accessToken = jwt.sign(
      { sub: user.id, org: user.organizationId, email: user.email, role: user.role },
      SECRET,
      { expiresIn },
    )
    return { accessToken, expiresIn }
  },
  verify(token) {
    try {
      const payload = jwt.verify(token, SECRET) as { sub: string; org: string }
      return { userId: payload.sub, orgId: payload.org }
    } catch {
      return null
    }
  },
}
