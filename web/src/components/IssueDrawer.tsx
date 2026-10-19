import { useMemo, useState } from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Tooltip from '@mui/material/Tooltip'
import Checkbox from '@mui/material/Checkbox'

// Icons
import CloseRounded from '@mui/icons-material/CloseRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import ShareOutlined from '@mui/icons-material/ShareOutlined'
import AddRounded from '@mui/icons-material/AddRounded'
import LinkRounded from '@mui/icons-material/LinkRounded'
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import SendRounded from '@mui/icons-material/SendRounded'

import { useIssueStore } from '@/store/issueStore'
import { useAuthStore } from '@/store/authStore'
import { projectById, userById, useCatalogStore } from '@/store/catalogStore'
import { IssueStatus, IssueType, Priority } from '@/types'
import { TypeIcon, PriorityIcon } from './IssueBadges'
import { UserAvatar } from './UserAvatar'
import { fromNow } from '@/formatting/display_text'

export function IssueDrawer() {
  const selectedIssueId = useIssueStore((s) => s.selectedIssueId)
  const issues = useIssueStore((s) => s.issues)
  const comments = useIssueStore((s) => s.comments)
  const selectIssue = useIssueStore((s) => s.selectIssue)
  const updateIssue = useIssueStore((s) => s.updateIssue)
  const createIssue = useIssueStore((s) => s.createIssue)
  const deleteIssue = useIssueStore((s) => s.deleteIssue)
  const addComment = useIssueStore((s) => s.addComment)
  const user = useAuthStore((s) => s.user)
  const users = useCatalogStore((s) => s.users)

  const issue = useMemo(() => issues.find((i) => i.id === selectedIssueId), [issues, selectedIssueId])
  const project = issue ? projectById(issue.projectId) : undefined
  const issueComments = useMemo(() => comments.filter((c) => c.issueId === issue?.id), [comments, issue?.id])

  // Subtasks
  const subtasks = useMemo(() => issues.filter((i) => i.parentId === issue?.id), [issues, issue?.id])
  const completedSubtasks = subtasks.filter((s) => s.status === IssueStatus.Done)
  const subtaskProgress = subtasks.length > 0 ? (completedSubtasks.length / subtasks.length) * 100 : 0

  // Activity Tab
  const [activityTab, setActivityTab] = useState<'comments' | 'history' | 'worklog'>('comments')
  const [newCommentBody, setNewCommentBody] = useState('')

  // Watchers toggle
  const [isWatching, setIsWatching] = useState(true)
  const [watchersCount, setWatchersCount] = useState(1)

  // Subtask Inline Input
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [isAddingSubtask, setIsAddingSubtask] = useState(false)

  // Link issue dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkTargetId, setLinkTargetId] = useState('')
  const [linkRelationship, setLinkRelationship] = useState('blocks')
  const [linkedIssues, setLinkedIssues] = useState<{ id: string; key: string; title: string; rel: string; status: IssueStatus }[]>([])

  // Log work dialog
  const [worklogDialogOpen, setWorklogDialogOpen] = useState(false)
  const [timeSpentHours, setTimeSpentHours] = useState('2')
  const [worklogDesc, setWorklogDesc] = useState('')
  const [loggedHours, setLoggedHours] = useState(4)

  if (!issue) {
    return (
      <Drawer anchor="right" open={false} onClose={() => selectIssue(null)}>
        <Box />
      </Drawer>
    )
  }

  const handleWatchToggle = () => {
    setIsWatching((prev) => {
      setWatchersCount((c) => (prev ? c - 1 : c + 1))
      return !prev
    })
  }

  const handleCreateSubtask = async () => {
    if (!newSubtaskTitle.trim()) return
    setIsAddingSubtask(true)
    try {
      await createIssue({
        projectId: issue.projectId,
        title: newSubtaskTitle.trim(),
        description: '',
        labels: [],
        type: IssueType.Subtask,
        status: IssueStatus.Todo,
        priority: Priority.Medium,
        reporterId: user?.id ?? users[0]?.id ?? 'usr_current',
        assigneeId: issue.assigneeId,
        parentId: issue.id,
      })
      setNewSubtaskTitle('')
    } catch (e) {
      console.error(e)
    } finally {
      setIsAddingSubtask(false)
    }
  }

  const handleAddLink = () => {
    const target = issues.find((i) => i.id === linkTargetId)
    if (target) {
      setLinkedIssues((prev) => [
        ...prev,
        { id: target.id, key: target.key, title: target.title, rel: linkRelationship, status: target.status },
      ])
      setLinkDialogOpen(false)
      setLinkTargetId('')
    }
  }

  const handleLogWork = () => {
    const hours = parseFloat(timeSpentHours) || 0
    setLoggedHours((prev) => prev + hours)
    setWorklogDialogOpen(false)
    setWorklogDesc('')
  }

  const handleSendComment = () => {
    if (!newCommentBody.trim() || !user) return
    addComment(issue.id, user.id, newCommentBody.trim())
    setNewCommentBody('')
  }

  return (
    <Drawer
      anchor="right"
      open={Boolean(issue)}
      onClose={() => selectIssue(null)}
      slotProps={{ paper: { sx: { width: { xs: '100%', md: 680 }, p: 0, bgcolor: 'background.paper' } } }}
    >
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <Stack
        direction="row"
        sx={{
          px: 2.5,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TypeIcon type={issue.type} size={18} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            {project?.key ?? 'PROJ'} /
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFamily: '"Fira Code", monospace' }}>
            {issue.key}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          {/* Watcher Button */}
          <Tooltip title={isWatching ? 'Stop watching' : 'Watch issue'}>
            <Button
              size="small"
              variant={isWatching ? ('soft' as any) : 'outlined'}
              startIcon={<VisibilityOutlined fontSize="small" />}
              onClick={handleWatchToggle}
              sx={{ fontSize: 12, height: 28, textTransform: 'none' }}
            >
              {watchersCount}
            </Button>
          </Tooltip>

          {/* Share */}
          <IconButton size="small" title="Share issue">
            <ShareOutlined fontSize="small" />
          </IconButton>

          {/* Delete */}
          <IconButton
            size="small"
            color="error"
            title="Delete issue"
            onClick={() => deleteIssue(issue.id)}
          >
            <DeleteOutlineRounded fontSize="small" />
          </IconButton>

          {/* Close */}
          <IconButton size="small" onClick={() => selectIssue(null)}>
            <CloseRounded />
          </IconButton>
        </Stack>
      </Stack>

      {/* 2. BODY CONTENT (SCROLLABLE) */}
      <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
        {/* Title */}
        <TextField
          fullWidth
          variant="standard"
          value={issue.title}
          onChange={(e) => updateIssue(issue.id, { title: e.target.value })}
          slotProps={{ input: { disableUnderline: true, sx: { fontSize: 22, fontWeight: 700, mb: 0.5 } } }}
        />

        {/* Action Buttons Toolbar */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 3 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddRounded />}
            onClick={() => setNewSubtaskTitle(' ')}
            sx={{ fontSize: 12 }}
          >
            Add subtask
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<LinkRounded />}
            onClick={() => setLinkDialogOpen(true)}
            sx={{ fontSize: 12 }}
          >
            Link work item
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<AccessTimeRounded />}
            onClick={() => setWorklogDialogOpen(true)}
            sx={{ fontSize: 12 }}
          >
            Log work
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<AutoAwesomeOutlined sx={{ color: '#8F44FD' }} />}
            sx={{ fontSize: 12, borderColor: 'rgba(143, 68, 253, 0.4)' }}
          >
            Improve with AI
          </Button>
        </Stack>

        {/* Description */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Description
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder="Add a detailed description... (Type '/' for tables, blocks and code)"
            value={issue.description ?? ''}
            onChange={(e) => updateIssue(issue.id, { description: e.target.value })}
            sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
          />
        </Box>

        {/* SUBTASKS SECTION */}
        <Box sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Subtasks ({completedSubtasks.length}/{subtasks.length})
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              {Math.round(subtaskProgress)}% completed
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={subtaskProgress} sx={{ height: 6, borderRadius: 1, mb: 2 }} />

          {/* Subtasks List */}
          <Stack spacing={1}>
            {subtasks.map((st) => {
              const isStDone = st.status === IssueStatus.Done
              return (
                <Stack
                  key={st.id}
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: 'center',
                    p: 0.75,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={isStDone}
                    onChange={(e) => updateIssue(st.id, { status: e.target.checked ? IssueStatus.Done : IssueStatus.Todo })}
                  />
                  <TypeIcon type={IssueType.Subtask} size={14} />
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: '"Fira Code", monospace',
                      fontWeight: 700,
                      textDecoration: isStDone ? 'line-through' : 'none',
                    }}
                  >
                    {st.key}
                  </Typography>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      flex: 1,
                      textDecoration: isStDone ? 'line-through' : 'none',
                      color: isStDone ? 'text.secondary' : 'text.primary',
                    }}
                  >
                    {st.title}
                  </Typography>
                  <Chip label={st.status.toUpperCase()} size="small" sx={{ fontSize: 10, height: 20 }} />
                </Stack>
              )
            })}

            {/* Quick Add Subtask Input */}
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Add subtask title..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSubtask()
                }}
              />
              <Button size="small" variant="contained" onClick={handleCreateSubtask} disabled={isAddingSubtask}>
                Add
              </Button>
            </Stack>
          </Stack>
        </Box>

        {/* LINKED ISSUES SECTION */}
        {linkedIssues.length > 0 && (
          <Box sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Linked Work Items ({linkedIssues.length})
            </Typography>
            <Stack spacing={1}>
              {linkedIssues.map((lk) => (
                <Stack key={lk.id} direction="row" spacing={1} sx={{ alignItems: 'center', p: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Chip label={lk.rel.replace('_', ' ')} size="small" color="warning" sx={{ fontSize: 10, height: 20 }} />
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>{lk.key}</Typography>
                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>{lk.title}</Typography>
                  <Chip label={lk.status.toUpperCase()} size="small" sx={{ fontSize: 10, height: 20 }} />
                </Stack>
              ))}
            </Stack>
          </Box>
        )}

        {/* TIME TRACKING (WORKLOGS) */}
        <Box sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Time Tracking
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {loggedHours}h logged · {issue.storyPoints ?? 3}d estimated
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={Math.min((loggedHours / 16) * 100, 100)} sx={{ height: 6, borderRadius: 1 }} />
        </Box>

        {/* ACTIVITY TABS */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activityTab} onChange={(_, val) => setActivityTab(val)}>
            <Tab label={`Comments (${issueComments.length})`} value="comments" sx={{ fontSize: 13, textTransform: 'none' }} />
            <Tab label="History" value="history" sx={{ fontSize: 13, textTransform: 'none' }} />
            <Tab label="Work log" value="worklog" sx={{ fontSize: 13, textTransform: 'none' }} />
          </Tabs>
        </Box>

        {/* Quick Suggestion Chips */}
        {activityTab === 'comments' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Quick Suggestions:
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {[
                'Who is working on this?',
                'Can I get more info on specs?',
                'Is this blocked by dependencies?',
                'Ready for QA testing.',
              ].map((suggestion, idx) => (
                <Chip
                  key={idx}
                  label={suggestion}
                  size="small"
                  clickable
                  onClick={() => setNewCommentBody(suggestion)}
                  sx={{ fontSize: 11 }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Comments Feed */}
        {activityTab === 'comments' && (
          <Stack spacing={2} sx={{ mb: 3 }}>
            {/* New Comment Box */}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              {user && <UserAvatar user={user} size={32} />}
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  placeholder="Add a comment... (Type @ to mention team members)"
                  value={newCommentBody}
                  onChange={(e) => setNewCommentBody(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Button
                  size="small"
                  variant="contained"
                  endIcon={<SendRounded />}
                  onClick={handleSendComment}
                  disabled={!newCommentBody.trim()}
                >
                  Save
                </Button>
              </Box>
            </Stack>

            {/* List of comments */}
            {issueComments.map((comment) => {
              const author = userById(comment.authorId)
              return (
                <Box key={comment.id} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
                    {author && <UserAvatar user={author} size={28} />}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{author?.name ?? 'User'}</Typography>
                      <Typography variant="caption" color="text.secondary">{fromNow(comment.createdAt)}</Typography>
                    </Box>
                  </Stack>
                  <Typography variant="body2">{comment.body}</Typography>
                </Box>
              )
            })}
          </Stack>
        )}

        {/* History Tab */}
        {activityTab === 'history' && (
          <Stack spacing={1.5}>
            {[
              { actor: 'Amjad', action: 'changed Status to In Progress', time: '10 minutes ago' },
              { actor: 'Amjad', action: 'updated Priority to High', time: '1 hour ago' },
              { actor: 'System', action: 'created issue via Web', time: 'Yesterday' },
            ].map((h, i) => (
              <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>{h.actor}</Typography>
                <Typography variant="caption" color="text.secondary">{h.action}</Typography>
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.disabled">{h.time}</Typography>
              </Stack>
            ))}
          </Stack>
        )}

        {/* Worklog Tab */}
        {activityTab === 'worklog' && (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Logged work history on this work item:
            </Typography>
            <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{loggedHours}h logged</Typography>
              <Typography variant="caption" color="text.secondary">Initial setup and API analysis</Typography>
            </Box>
          </Stack>
        )}
      </Box>

      {/* 3. SIDE PROPERTIES PANEL (RIGHT ATTRIBUTES) */}
      <Box sx={{ p: 2.5, borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 1.5, display: 'block' }}>
          Attributes
        </Typography>

        <Stack spacing={1.5}>
          {/* Status */}
          <TextField
            select
            size="small"
            label="Status"
            value={issue.status}
            onChange={(e) => updateIssue(issue.id, { status: e.target.value as IssueStatus })}
          >
            {Object.values(IssueStatus).map((st) => (
              <MenuItem key={st} value={st}>
                {st.replace('_', ' ').toUpperCase()}
              </MenuItem>
            ))}
          </TextField>

          {/* Assignee */}
          <TextField
            select
            size="small"
            label="Assignee"
            value={issue.assigneeId ?? ''}
            onChange={(e) => updateIssue(issue.id, { assigneeId: e.target.value })}
          >
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
          </TextField>

          {/* Priority */}
          <TextField
            select
            size="small"
            label="Priority"
            value={issue.priority}
            onChange={(e) => updateIssue(issue.id, { priority: e.target.value as Priority })}
          >
            {Object.values(Priority).map((p) => (
              <MenuItem key={p} value={p}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <PriorityIcon priority={p} />
                  <span>{p}</span>
                </Stack>
              </MenuItem>
            ))}
          </TextField>

          {/* Story Points */}
          <TextField
            size="small"
            label="Story Points"
            type="number"
            value={issue.storyPoints ?? ''}
            onChange={(e) => updateIssue(issue.id, { storyPoints: parseInt(e.target.value) || 0 })}
          />
        </Stack>
      </Box>

      {/* LINK ISSUE DIALOG */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Link work item</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              select
              size="small"
              label="Relationship"
              value={linkRelationship}
              onChange={(e) => setLinkRelationship(e.target.value)}
            >
              <MenuItem value="blocks">blocks</MenuItem>
              <MenuItem value="is_blocked_by">is blocked by</MenuItem>
              <MenuItem value="relates_to">relates to</MenuItem>
              <MenuItem value="duplicates">duplicates</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Work item"
              value={linkTargetId}
              onChange={(e) => setLinkTargetId(e.target.value)}
            >
              {issues.filter((i) => i.id !== issue.id).map((i) => (
                <MenuItem key={i.id} value={i.id}>
                  {i.key} — {i.title}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddLink} disabled={!linkTargetId}>Link</Button>
        </DialogActions>
      </Dialog>

      {/* LOG WORK DIALOG */}
      <Dialog open={worklogDialogOpen} onClose={() => setWorklogDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Log work</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Time spent (hours)"
              type="number"
              value={timeSpentHours}
              onChange={(e) => setTimeSpentHours(e.target.value)}
            />
            <TextField
              size="small"
              multiline
              minRows={2}
              label="Work description"
              value={worklogDesc}
              onChange={(e) => setWorklogDesc(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorklogDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLogWork}>Log time</Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  )
}
