import { useEffect, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import { api } from '@/core/api/client'
import { useAuthStore } from '@/store/authStore'
import { useCatalogStore } from '@/store/catalogStore'
import { useIssueStore } from '@/store/issueStore'
import { useUiStore } from '@/store/uiStore'

export function DataBootstrap({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const loaded = useCatalogStore((s) => s.loaded)
  const load = useCatalogStore((s) => s.load)
  const reset = useCatalogStore((s) => s.reset)
  const hydrate = useIssueStore((s) => s.hydrate)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setError(null)
    void (async () => {
      try {
        await load()
        const [issues, comments, sprints] = await Promise.all([
          api.get('/issues').then((r) => r.data).catch(() => []),
          api.get('/comments').then((r) => r.data).catch(() => []),
          api.get('/sprints').then((r) => r.data).catch(() => []),
        ])
        if (cancelled) return
        hydrate(
          Array.isArray(issues) ? issues : [],
          Array.isArray(comments) ? comments : [],
          Array.isArray(sprints) ? sprints : [],
        )
        const projects = useCatalogStore.getState().projects
        const selected = useUiStore.getState().selectedProjectId
        if (projects.length && !projects.some((p) => p.id === selected)) {
          useUiStore.getState().setSelectedProjectId(projects[0]!.id)
        }
      } catch (e) {
        if (cancelled) return
        const err = e as { response?: { status?: number; data?: unknown }; message?: unknown }
        if (err.response?.status === 401) {
          logout()
          return
        }
        let msg = t('app.loadError')
        const errData = err.response?.data
        if (typeof errData === 'string') {
          msg = errData
        } else if (errData && typeof errData === 'object') {
          const d = errData as Record<string, unknown>
          if (typeof d.error === 'string') msg = d.error
          else if (typeof d.message === 'string') msg = d.message
        } else if (typeof err.message === 'string') {
          msg = err.message
        }
        setError(msg)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, tick, load, hydrate, logout, t])

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Stack spacing={2} sx={{ maxWidth: 440 }}>
          <Alert severity="error" role="alert">
            {t('app.loadError')}
            {typeof error === 'string' && error !== t('app.loadError') ? ` (${error})` : ''}
          </Alert>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={() => {
                reset()
                setError(null)
                setTick((n) => n + 1)
              }}
            >
              {t('app.retry')}
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                logout()
              }}
            >
              {t('app.logout')}
            </Button>
          </Stack>
        </Stack>
      </Box>
    )
  }

  if (!loaded) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">{t('app.loading')}</Typography>
      </Box>
    )
  }

  return children
}
