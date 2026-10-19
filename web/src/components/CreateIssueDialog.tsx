import { useState, type MouseEvent } from 'react'
import Dialog from '@mui/material/Dialog'
import Drawer from '@mui/material/Drawer'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Menu from '@mui/material/Menu'
import Tooltip from '@mui/material/Tooltip'

// Icons
import CloseRounded from '@mui/icons-material/CloseRounded'
import ViewSidebarOutlined from '@mui/icons-material/ViewSidebarOutlined'
import FullscreenRounded from '@mui/icons-material/FullscreenRounded'
import FullscreenExitRounded from '@mui/icons-material/FullscreenExitRounded'
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded'
import BoltRounded from '@mui/icons-material/BoltRounded'

import { useIssueStore } from '@/store/issueStore'
import { useUiStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useCatalogStore } from '@/store/catalogStore'
import { IssueStatus, IssueType, Priority } from '@/types'
import { TypeIcon, PriorityIcon } from './IssueBadges'
import { UserAvatar } from './UserAvatar'

export function CreateIssueDialog() {
  const open = useIssueStore((s) => s.createOpen)
  const setCreateOpen = useIssueStore((s) => s.setCreateOpen)
  const createIssue = useIssueStore((s) => s.createIssue)
  const selectIssue = useIssueStore((s) => s.selectIssue)
  const issues = useIssueStore((s) => s.issues)
  const projectId = useUiStore((s) => s.selectedProjectId)
  const user = useAuthStore((s) => s.user)
  const projects = useCatalogStore((s) => s.projects)
  const users = useCatalogStore((s) => s.users)

  // Form Fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<IssueType>(IssueType.Task)
  const [priority, setPriority] = useState<Priority>(Priority.Medium)
  const [assigneeId, setAssigneeId] = useState<string>('')
  const [parentId, setParentId] = useState<string>('')
  const [dueDate, setDueDate] = useState<string>('')
  const [points, setPoints] = useState('3')
  const [createAnother, setCreateAnother] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal Positioning Modes (Floating Dialog vs Docked Drawer vs Fullscreen)
  const [isDocked, setIsDocked] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Chip Pickers Anchors
  const [assigneeAnchor, setAssigneeAnchor] = useState<HTMLElement | null>(null)
  const [parentAnchor, setParentAnchor] = useState<HTMLElement | null>(null)
  const [priorityAnchor, setPriorityAnchor] = useState<HTMLElement | null>(null)

  const activeProject = projects.find((p) => p.id === projectId) ?? projects[0]
  const assignedUser = users.find((u) => u.id === assigneeId)
  const parentIssue = issues.find((i) => i.id === parentId)

  const reset = () => {
    setTitle('')
    setDescription('')
    setType(IssueType.Task)
    setPriority(Priority.Medium)
    setAssigneeId('')
    setParentId('')
    setDueDate('')
    setPoints('3')
  }

  const handleClose = () => {
    reset()
    setIsDocked(false)
    setIsFullscreen(false)
    setCreateOpen(false)
  }

  const handleSubmit = async () => {
    if (!title.trim()) return
    setIsSubmitting(true)
    try {
      const created = await createIssue({
        projectId: activeProject?.id ?? 'proj_core',
        title: title.trim(),
        description: description.trim(),
        labels: [],
        type,
        status: IssueStatus.Todo,
        priority,
        assigneeId: assigneeId || undefined,
        reporterId: user?.id ?? users[0]?.id ?? 'usr_current',
        parentId: parentId || undefined,
        dueDate: dueDate || undefined,
        storyPoints: parseInt(points) || 3,
      })

      if (createAnother) {
        setTitle('')
        setDescription('')
      } else {
        handleClose()
        selectIssue(created.id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Inner Form Content
  const formContent = (
    <Box sx={{ p: 2.5 }}>
      {/* 1. Header controls */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
          Create work in <span style={{ color: '#0052CC', fontWeight: 700 }}>{activeProject?.name ?? 'My Team'}</span>
        </Typography>

        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Tooltip title={isDocked ? 'Undock' : 'Dock to side'}>
            <IconButton size="small" onClick={() => setIsDocked((p) => !p)}>
              <ViewSidebarOutlined fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={isFullscreen ? 'Exit full screen' : 'Expand full screen'}>
            <IconButton size="small" onClick={() => setIsFullscreen((p) => !p)}>
              {isFullscreen ? <FullscreenExitRounded fontSize="small" /> : <FullscreenRounded fontSize="small" />}
            </IconButton>
          </Tooltip>

          <IconButton size="small" onClick={handleClose}>
            <CloseRounded fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {/* 2. Issue Type Selector Pill */}
      <Box sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          value={type}
          onChange={(e) => setType(e.target.value as IssueType)}
          sx={{
            width: 140,
            '& .MuiSelect-select': { py: 0.5, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 },
          }}
        >
          {Object.values(IssueType).map((ty) => (
            <MenuItem key={ty} value={ty}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TypeIcon type={ty} size={16} />
                <span>{ty.toUpperCase()}</span>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* 3. Large Headline Summary Input */}
      <TextField
        fullWidth
        autoFocus
        variant="standard"
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
        }}
        slotProps={{
          input: {
            disableUnderline: true,
            sx: { fontSize: 20, fontWeight: 700, mb: 2 },
          },
        }}
      />

      {/* 4. Attribute Filter Chips Row */}
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 3 }}>
        {/* Assignee Pill */}
        <Chip
          icon={assignedUser ? <UserAvatar user={assignedUser} size={18} /> : <PersonOutlineRounded sx={{ fontSize: 16 }} />}
          label={assignedUser ? assignedUser.name : 'Automatic'}
          clickable
          onClick={(e: MouseEvent<HTMLDivElement>) => setAssigneeAnchor(e.currentTarget)}
          sx={{ fontWeight: 500, fontSize: 12 }}
        />

        {/* Parent Pill */}
        <Chip
          icon={<BoltRounded sx={{ fontSize: 16 }} />}
          label={parentIssue ? parentIssue.key : 'Parent'}
          clickable
          onClick={(e: MouseEvent<HTMLDivElement>) => setParentAnchor(e.currentTarget)}
          sx={{ fontWeight: 500, fontSize: 12 }}
        />

        {/* Priority Pill */}
        <Chip
          icon={<PriorityIcon priority={priority} size={16} />}
          label={priority.toUpperCase()}
          clickable
          onClick={(e: MouseEvent<HTMLDivElement>) => setPriorityAnchor(e.currentTarget)}
          sx={{ fontWeight: 500, fontSize: 12 }}
        />

        {/* Due Date Pill */}
        <TextField
          type="date"
          size="small"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          sx={{
            width: 140,
            '& .MuiInputBase-input': { py: 0.5, fontSize: 12 },
          }}
        />
      </Stack>

      {/* 5. Description Editor with Slash Commands Placeholder */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          multiline
          minRows={5}
          placeholder="Type '/' to insert files, tables, code blocks and more"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{
            bgcolor: 'background.paper',
            '& .MuiInputBase-input': { fontSize: 14, lineHeight: 1.6 },
          }}
        />
      </Box>

      {/* 6. Bottom Actions Bar */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <FormControlLabel
          control={<Checkbox size="small" checked={createAnother} onChange={(e) => setCreateAnother(e.target.checked)} />}
          label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Create another</Typography>}
        />

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
            sx={{ bgcolor: '#0052CC', '&:hover': { bgcolor: '#0747A6' }, fontWeight: 700 }}
          >
            Create
          </Button>
        </Stack>
      </Stack>

      {/* ASSIGNEE MENU */}
      <Menu open={Boolean(assigneeAnchor)} anchorEl={assigneeAnchor} onClose={() => setAssigneeAnchor(null)}>
        <MenuItem
          onClick={() => {
            if (user) setAssigneeId(user.id)
            setAssigneeAnchor(null)
          }}
          sx={{ fontSize: 13, fontWeight: 600, color: '#0052CC' }}
        >
          Assign to me
        </MenuItem>
        <MenuItem onClick={() => { setAssigneeId(''); setAssigneeAnchor(null); }} sx={{ fontSize: 13 }}>
          Automatic (Unassigned)
        </MenuItem>
        {users.map((u) => (
          <MenuItem key={u.id} onClick={() => { setAssigneeId(u.id); setAssigneeAnchor(null); }} sx={{ fontSize: 13 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <UserAvatar user={u} size={20} />
              <span>{u.name}</span>
            </Stack>
          </MenuItem>
        ))}
      </Menu>

      {/* PARENT ISSUE MENU */}
      <Menu open={Boolean(parentAnchor)} anchorEl={parentAnchor} onClose={() => setParentAnchor(null)}>
        <MenuItem onClick={() => { setParentId(''); setParentAnchor(null); }} sx={{ fontSize: 13 }}>
          None (Top level work item)
        </MenuItem>
        {issues.filter((i) => i.type === IssueType.Epic || i.type === IssueType.Story).map((i) => (
          <MenuItem key={i.id} onClick={() => { setParentId(i.id); setParentAnchor(null); }} sx={{ fontSize: 13 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TypeIcon type={i.type} size={14} />
              <span>{i.key} — {i.title}</span>
            </Stack>
          </MenuItem>
        ))}
      </Menu>

      {/* PRIORITY MENU */}
      <Menu open={Boolean(priorityAnchor)} anchorEl={priorityAnchor} onClose={() => setPriorityAnchor(null)}>
        {Object.values(Priority).map((p) => (
          <MenuItem key={p} onClick={() => { setPriority(p); setPriorityAnchor(null); }} sx={{ fontSize: 13 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <PriorityIcon priority={p} />
              <span style={{ textTransform: 'capitalize' }}>{p}</span>
            </Stack>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )

  if (!open) return null

  // If Docked to Side, render as right drawer
  if (isDocked) {
    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        slotProps={{ paper: { sx: { width: 480, p: 0, bgcolor: 'background.paper', boxShadow: 6 } } }}
      >
        {formContent}
      </Drawer>
    )
  }

  // Floating Dialog
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      fullScreen={isFullscreen}
      maxWidth={isFullscreen ? false : 'md'}
      slotProps={{
        paper: {
          sx: {
            borderRadius: isFullscreen ? 0 : 3,
            boxShadow: 8,
            overflow: 'hidden',
          },
        },
      }}
    >
      {formContent}
    </Dialog>
  )
}
