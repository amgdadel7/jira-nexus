import { createApp } from './presentation/http.ts'
import { ensureDemoFixes, seedIfNeeded } from './infrastructure/seed.ts'

seedIfNeeded()
ensureDemoFixes()
if (process.argv.includes('--seed-only')) process.exit(0)

const app = createApp()

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 8080)
  app.listen(port, '0.0.0.0', () => {
    console.log(`Nexus API on http://0.0.0.0:${port}`)
  })
}

export default app
