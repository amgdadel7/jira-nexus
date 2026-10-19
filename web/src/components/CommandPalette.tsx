import { useMemo, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import TextField from '@mui/material/TextField'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { useNavigate } from 'react-router-dom'
import { useUiStore } from '@/store/uiStore'
import { useIssueStore } from '@/store/issueStore'
import { useCatalogStore } from '@/store/catalogStore'
import { TypeIcon } from './IssueBadges'
import { useTranslation } from 'react-i18next'
import type { IssueType } from '@/types'

interface CommandItem {
  id: string
  label: string
  hint: string
  issueType?: IssueType
  run: () => void
}

export function CommandPalette() {
  const { t } = useTranslation()
  const open = useUiStore((s) => s.commandOpen)
  const setCommandOpen = useUiStore((s) => s.setCommandOpen)
  const setCreateOpen = useIssueStore((s) => s.setCreateOpen)
  const selectIssue = useIssueStore((s) => s.selectIssue)
  const issues = useIssueStore((s) => s.issues)
  const projects = useCatalogStore((s) => s.projects)
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const results = useMemo<CommandItem[]>(() => {
    const query = q.trim().toLowerCase()
    const pages: CommandItem[] = [
      { id: 'p-dash', label: t('command.goDashboard'), hint: t('command.page'), run: () => navigate('/') },
      { id: 'p-summary', label: 'Go to Project Summary', hint: 'Overview & KPIs', run: () => navigate('/summary') },
      { id: 'p-proj', label: t('command.goProjects'), hint: t('command.page'), run: () => navigate('/projects') },
      { id: 'p-board', label: t('command.goBoard'), hint: t('command.page'), run: () => navigate('/boards') },
      { id: 'p-timeline', label: 'Go to Timeline & Gantt', hint: 'Schedules & Epics', run: () => navigate('/timeline') },
      { id: 'p-calendar', label: 'Go to Calendar', hint: 'Monthly & Unscheduled', run: () => navigate('/calendar') },
      { id: 'p-forms', label: 'Go to Forms & Intake', hint: 'Request templates', run: () => navigate('/forms') },
      { id: 'p-documents', label: 'Go to Pages & Documents', hint: 'Confluence Wiki', run: () => navigate('/documents') },
      { id: 'p-automations', label: 'Go to Automations', hint: 'Rules & Triggers', run: () => navigate('/automations') },
      { id: 'p-dev', label: 'Go to Development & DORA', hint: 'DevOps & Repos', run: () => navigate('/development') },
      { id: 'p-sprint', label: t('command.goSprint'), hint: t('command.page'), run: () => navigate('/sprints') },
      { id: 'p-backlog', label: t('command.goBacklog'), hint: t('command.page'), run: () => navigate('/backlog') },
      { id: 'p-issues', label: t('command.goIssues'), hint: t('command.page'), run: () => navigate('/issues') },
      { id: 'p-reports', label: t('command.goReports'), hint: t('command.page'), run: () => navigate('/reports') },
      { id: 'p-team', label: t('command.goTeam'), hint: t('command.page'), run: () => navigate('/team') },
      { id: 'p-settings', label: 'Go to Jira Settings', hint: 'Work types & Fields', run: () => navigate('/settings') },
      { id: 'p-create', label: t('command.create'), hint: t('command.action'), run: () => setCreateOpen(true) },
    ]
    const issueHits = issues
      .filter((i) => !query || i.title.toLowerCase().includes(query) || i.key.toLowerCase().includes(query))
      .slice(0, 8)
      .map((i) => ({
        id: i.id,
        label: `${i.key}  ${i.title}`,
        hint: t('command.issue'),
        issueType: i.type,
        run: () => {
          navigate('/boards')
          selectIssue(i.id)
        },
      }))
    const projectHits = projects
      .filter((p) => !query || p.name.toLowerCase().includes(query) || p.key.toLowerCase().includes(query))
      .slice(0, 4)
      .map((p) => ({
        id: p.id,
        label: `${p.key}  ${p.name}`,
        hint: t('command.project'),
        run: () => navigate('/projects'),
      }))
    const pageHits = pages.filter((p) => !query || p.label.toLowerCase().includes(query))
    return [...pageHits, ...projectHits, ...issueHits].slice(0, 12)
  }, [q, issues, projects, navigate, selectIssue, setCreateOpen, t])

  const close = () => {
    setCommandOpen(false)
    setQ('')
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { overflow: 'hidden' } } }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          autoFocus
          fullWidth
          placeholder={t('command.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          variant="standard"
          slotProps={{ input: { disableUnderline: true, sx: { fontSize: 16, px: 1 } } }}
        />
      </Box>
      <List sx={{ py: 0, maxHeight: 420, overflow: 'auto' }}>
        {results.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary" variant="body2">
            {t('command.none')}
          </Typography>
        )}
        {results.map((r) => (
          <ListItemButton
            key={r.id}
            onClick={() => {
              r.run()
              close()
            }}
          >
            {r.issueType ? (
              <Box sx={{ me: 1.25, display: 'flex' }}>
                <TypeIcon type={r.issueType} />
              </Box>
            ) : null}
            <ListItemText
              primary={r.label}
              secondary={r.hint}
              slotProps={{ primary: { noWrap: true, sx: { fontSize: 14 } } }}
            />
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  )
}
