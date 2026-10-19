import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import MoreVertRounded from '@mui/icons-material/MoreVertRounded'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useMemo } from 'react'
import { BOARD_COLUMNS, IssueStatus, type Issue } from '@/types'
import { TYPE_META, TypeIcon, PriorityIcon } from './IssueBadges'
import { UserAvatar } from './UserAvatar'
import { useIssueStore } from '@/store/issueStore'
import { useTranslation } from 'react-i18next'

interface Props {
  issue: Issue
  onOpen: (id: string) => void
  overlay?: boolean
}

export function IssueCard({ issue, onOpen, overlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { status: issue.status },
  })
  const moveIssue = useIssueStore((s) => s.moveIssue)
  const issues = useIssueStore((s) => s.issues)
  const { t } = useTranslation()
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null)
  const rail = TYPE_META[issue.type]?.color ?? '#0052CC'

  // Subtasks progress
  const subtasks = issues.filter((i) => i.parentId === issue.id)
  const doneSubtasks = subtasks.filter((s) => s.status === IssueStatus.Done)

  // Overdue calculation
  const isOverdue = useMemo(() => {
    if (!issue.dueDate || issue.status === IssueStatus.Done) return false
    return new Date(issue.dueDate).getTime() < new Date().setHours(0, 0, 0, 0)
  }, [issue.dueDate, issue.status])

  return (
    <Paper
      ref={setNodeRef}
      elevation={0}
      sx={{
        mb: 1,
        cursor: 'grab',
        borderRadius: 1.5,
        border: 1,
        borderColor: isOverdue ? 'error.light' : 'divider',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        bgcolor: 'background.paper',
        display: 'flex',
        overflow: 'hidden',
        boxShadow: overlay ? 6 : '0 1px 3px rgba(0,0,0,0.06)',
        '&:hover': { borderColor: isOverdue ? 'error.main' : 'primary.main', boxShadow: '0 3px 8px rgba(0,0,0,0.1)' },
      }}
    >
      <Box aria-hidden sx={{ width: 4, bgcolor: rail, flexShrink: 0 }} />
      <Box sx={{ p: 1.25, flex: 1, minWidth: 0 }}>
        {/* Top Key, Priority & Actions */}
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Box {...attributes} {...listeners} sx={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, cursor: 'grab' }}>
            <TypeIcon type={issue.type} />
            <Typography className="mono" variant="caption" color="text.secondary" sx={{ ml: 0.75, fontWeight: 700 }} component="span">
              {issue.key}
            </Typography>
          </Box>
          <PriorityIcon priority={issue.priority} />
          <IconButton
            size="small"
            aria-label={`Move ${issue.key}`}
            onClick={(e) => {
              e.stopPropagation()
              setMenuEl(e.currentTarget)
            }}
            sx={{ width: 28, height: 28 }}
          >
            <MoreVertRounded sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>

        {/* Title */}
        <Typography
          variant="body2"
          sx={{
            my: 0.75,
            lineHeight: 1.35,
            cursor: 'pointer',
            fontWeight: 600,
            textDecoration: issue.status === IssueStatus.Done ? 'line-through' : 'none',
            color: issue.status === IssueStatus.Done ? 'text.secondary' : 'text.primary',
          }}
          onClick={() => onOpen(issue.id)}
        >
          {issue.title}
        </Typography>

        {/* Overdue Warning Badge */}
        {isOverdue && (
          <Box sx={{ mb: 0.75 }}>
            <Chip
              size="small"
              icon={<WarningAmberRounded sx={{ fontSize: '13px !important', color: '#BF2600 !important' }} />}
              label={`${new Date(issue.dueDate!).toLocaleDateString()} Overdue`}
              sx={{
                height: 20,
                fontSize: 10,
                fontWeight: 700,
                bgcolor: '#FFEBE6',
                color: '#BF2600',
                borderRadius: 0.5,
              }}
            />
          </Box>
        )}

        {/* Subtask count if any */}
        {subtasks.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.75 }}>
            <CheckCircleOutlineRounded sx={{ fontSize: 13, color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>
              {doneSubtasks.length}/{subtasks.length}
            </Typography>
          </Stack>
        )}

        {/* Labels */}
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ mb: 0.75, flexWrap: 'wrap' }}>
          {issue.labels.slice(0, 2).map((l) => (
            <Chip key={l} label={l} size="small" sx={{ height: 18, fontSize: 10, borderRadius: 0.5 }} />
          ))}
        </Stack>

        {/* Footer Assignee & Story Points */}
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <UserAvatar userId={issue.assigneeId} size={22} />
          {issue.storyPoints != null && (
            <Box sx={{ px: 0.75, py: 0.2, bgcolor: 'action.hover', borderRadius: 0.5 }}>
              <Typography className="mono" variant="caption" sx={{ fontWeight: 700, fontSize: 11 }}>
                {issue.storyPoints}
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      {/* Move Menu */}
      <Menu
        anchorEl={menuEl}
        open={Boolean(menuEl)}
        onClose={() => setMenuEl(null)}
        onClick={(e) => e.stopPropagation()}
      >
        {BOARD_COLUMNS.map((c) => (
          <MenuItem
            key={c.status}
            disabled={c.status === issue.status}
            onClick={() => {
              moveIssue(issue.id, c.status)
              setMenuEl(null)
            }}
            sx={{ fontSize: 13 }}
          >
            {t('board.moveTo', { status: t(`status.${c.status}`) })}
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  )
}
