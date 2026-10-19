import type { MailMessage } from '../domain/entities.ts'
import type { MailPort } from '../domain/ports.ts'

const box: MailMessage[] = []

export const mail: MailPort = {
  send(to, subject, text, html) {
    const msg: MailMessage = {
      id: crypto.randomUUID(),
      to,
      subject,
      text,
      html,
      createdAt: new Date().toISOString(),
    }
    box.unshift(msg)
    console.log(`[mail] → ${to} | ${subject}\n${text}\n`)
    return msg
  },
  list(to) {
    return to ? box.filter((m) => m.to === to) : box
  },
}
