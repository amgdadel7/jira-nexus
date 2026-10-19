import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import { projectById, userById, useCatalogStore } from '@/store/catalogStore'
import { UserAvatar } from './UserAvatar'
import { fromNow } from '@/formatting/display_text'
import { useTranslation } from 'react-i18next'

export function ActivityFeed({ dense = false }: { dense?: boolean }) {
  const activities = useCatalogStore((s) => s.activities)
  const items = dense ? activities.slice(0, 10) : activities
  return (
    <Stack spacing={1.25}>
      {items.map((a) => {
        const user = userById(a.userId)
        const project = a.projectId ? projectById(a.projectId) : undefined
        return (
          <Stack key={a.id} direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
            <UserAvatar user={user} size={32} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2">
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {user?.name}
                </Box>{' '}
                {a.action}
                {project && (
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    {' '}
                    · {project.name}
                  </Box>
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {fromNow(a.timestamp)}
              </Typography>
            </Box>
          </Stack>
        )
      })}
    </Stack>
  )
}

export function ActivityPanel() {
  const { t } = useTranslation()
  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto', border: 0 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {t('activity.title')}
      </Typography>
      <ActivityFeed />
    </Paper>
  )
}
