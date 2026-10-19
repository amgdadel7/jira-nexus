import { useState } from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import Paper from '@mui/material/Paper'

// Icons
import CloseRounded from '@mui/icons-material/CloseRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import SendRounded from '@mui/icons-material/SendRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import CheckRounded from '@mui/icons-material/CheckRounded'
import TaskAltRounded from '@mui/icons-material/TaskAltRounded'
import BugReportRounded from '@mui/icons-material/BugReportRounded'
import BoltRounded from '@mui/icons-material/BoltRounded'
import InsightsRounded from '@mui/icons-material/InsightsRounded'

import { useUiStore } from '@/store/uiStore'
import { useIssueStore } from '@/store/issueStore'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  suggestedIssues?: string[]
}

const DEFAULT_PROMPTS = [
  { label: 'Summarize sprint blockers', icon: <BugReportRounded sx={{ fontSize: 14 }} /> },
  { label: 'What is our current workload?', icon: <InsightsRounded sx={{ fontSize: 14 }} /> },
  { label: 'Draft acceptance criteria for KAN-1', icon: <TaskAltRounded sx={{ fontSize: 14 }} /> },
  { label: 'Suggest subtasks for KAN-2', icon: <BoltRounded sx={{ fontSize: 14 }} /> },
]

export function RovoAssistantDrawer() {
  const open = useUiStore((s) => s.rovoOpen)
  const setOpen = useUiStore((s) => s.setRovoOpen)
  const issues = useIssueStore((s) => s.issues)
  const selectIssue = useIssueStore((s) => s.selectIssue)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome_1',
      role: 'assistant',
      content: `👋 **Hi! I'm Rovo**, your Atlassian Intelligence assistant.\n\nI have live context on your **My Team (KAN)** project (${issues.length} active work items).\n\nAsk me anything like:\n- *"What are the blocker tickets right now?"*\n- *"Draft acceptance criteria for KAN-1"*\n- *"Summarize progress across Todo and In Progress"*\n- *"Generate release notes for Done items"*`,
      timestamp: 'Just now',
    },
  ])

  const handleSend = (textToSend?: string) => {
    const q = (textToSend || input).trim()
    if (!q || loading) return

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Generate intelligent response based on current issues
    setTimeout(() => {
      let aiResponse = ''
      const matchedIssues: string[] = []

      const qLower = q.toLowerCase()

      if (qLower.includes('blocker') || qLower.includes('bug') || qLower.includes('problem')) {
        const bugs = issues.filter((i) => i.type.toLowerCase().includes('bug') || i.priority.toLowerCase().includes('highest'))
        if (bugs.length > 0) {
          aiResponse = `Found **${bugs.length} critical work item(s)** requiring immediate attention:\n\n`
          bugs.forEach((b) => {
            aiResponse += `- **${b.key}**: ${b.title} *(Status: ${b.status}, Priority: ${b.priority})*\n`
            matchedIssues.push(b.key)
          })
          aiResponse += `\n💡 **Recommendation:** Prioritize these items before pulling new backlog stories.`
        } else {
          aiResponse = `Great news! No critical blockers or blocker bugs are currently flagged in project **KAN**.`
        }
      } else if (qLower.includes('acceptance criteria') || qLower.includes('kan-1') || qLower.includes('criteria')) {
        aiResponse = `Here is a drafted **Acceptance Criteria** specification for **KAN-1** using Gherkin format:\n\n`
        aiResponse += `### Scenario 1: Initial Gap Analysis Execution\n`
        aiResponse += `- **Given** the user navigates to the Jira board or list view\n`
        aiResponse += `- **When** reviewing the project structure against live Jira Cloud\n`
        aiResponse += `- **Then** all 16 data entities and UI components must render with zero layout shift\n\n`
        aiResponse += `### Scenario 2: Inline Worklog & Attribute Tracking\n`
        aiResponse += `- **Given** an open issue drawer\n`
        aiResponse += `- **When** logging time or changing assignees\n`
        aiResponse += `- **Then** the progress bar updates immediately and changes persist in the database.`
        matchedIssues.push('KAN-1')
      } else if (qLower.includes('workload') || qLower.includes('summary') || qLower.includes('progress')) {
        const todo = issues.filter((i) => i.status.toLowerCase().includes('todo') || i.status.toLowerCase().includes('backlog')).length
        const inProgress = issues.filter((i) => i.status.toLowerCase().includes('progress')).length
        const done = issues.filter((i) => i.status.toLowerCase().includes('done')).length

        aiResponse = `### Project Health & Workload Overview\n\n`
        aiResponse += `- **Total Issues:** ${issues.length}\n`
        aiResponse += `- **To Do / Backlog:** ${todo}\n`
        aiResponse += `- **In Progress:** ${inProgress}\n`
        aiResponse += `- **Completed (Done):** ${done}\n\n`
        aiResponse += `Velocity is steady. Team has completed **${Math.round((done / (issues.length || 1)) * 100)}%** of planned scope.`
      } else if (qLower.includes('subtask') || qLower.includes('kan-2')) {
        aiResponse = `Here are suggested subtasks for **KAN-2**:\n\n`
        aiResponse += `1. **KAN-2.1:** Implement unit tests for backend API controllers\n`
        aiResponse += `2. **KAN-2.2:** Add optimistic UI updates on list cell click\n`
        aiResponse += `3. **KAN-2.3:** Verify cross-browser responsive breakpoints\n\n`
        aiResponse += `Would you like me to auto-generate these subtasks in the database?`
        matchedIssues.push('KAN-2')
      } else {
        aiResponse = `Based on project **My Team (KAN)**:\n\nI evaluated your query: *"${q}"* against our backlog, sprints, and code repositories.\n\nAll systems are operating normally. You have **${issues.length} active work items** currently mapped. Is there a specific ticket or workflow you'd like me to analyze further?`
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedIssues: matchedIssues.length > 0 ? matchedIssues : undefined,
        },
      ])
      setLoading(false)
    }, 600)
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => setOpen(false)}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 420 },
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
            boxShadow: 24,
          },
        },
      }}
    >
      {/* HEADER */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, #8F44FD 0%, #0052CC 100%)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 2px 8px rgba(143, 68, 253, 0.35)',
            }}
          >
            <AutoAwesomeRounded sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: 14 }}>
                Rovo
              </Typography>
              <Chip
                label="Atlassian Intelligence"
                size="small"
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, rgba(143, 68, 253, 0.15) 0%, rgba(0, 82, 204, 0.15) 100%)',
                  color: '#8F44FD',
                }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
              Context: My Team (KAN)
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Clear chat">
            <IconButton
              size="small"
              onClick={() =>
                setMessages([
                  {
                    id: 'w_cleared',
                    role: 'assistant',
                    content: 'Chat cleared. How can I help you with your Jira work today?',
                    timestamp: 'Just now',
                  },
                ])
              }
            >
              <DeleteOutlineRounded fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseRounded fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {/* QUICK SUGGESTIONS CHIPS */}
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, mb: 1, display: 'block', fontSize: 11, textTransform: 'uppercase' }}>
          Suggested actions
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          {DEFAULT_PROMPTS.map((p, idx) => (
            <Chip
              key={idx}
              icon={p.icon}
              label={p.label}
              size="small"
              onClick={() => handleSend(p.label)}
              clickable
              sx={{
                fontSize: 11.5,
                fontWeight: 600,
                borderRadius: 1.5,
                py: 0.5,
                bgcolor: 'action.hover',
                '&:hover': {
                  bgcolor: 'action.selected',
                  color: 'primary.main',
                },
              }}
            />
          ))}
        </Stack>
      </Box>

      {/* MESSAGE FEED */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {messages.map((m) => {
          const isUser = m.role === 'user'
          return (
            <Box
              key={m.id}
              sx={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 1.75,
                  borderRadius: 2,
                  bgcolor: isUser ? 'primary.main' : 'background.paper',
                  color: isUser ? 'primary.contrastText' : 'text.primary',
                  border: isUser ? 'none' : 1,
                  borderColor: 'divider',
                  boxShadow: isUser ? '0 2px 8px rgba(0, 82, 204, 0.25)' : 'none',
                }}
              >
                {!isUser && (
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <AutoAwesomeRounded sx={{ fontSize: 14, color: '#8F44FD' }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, color: '#8F44FD' }}>
                        Rovo AI
                      </Typography>
                    </Stack>
                    <IconButton size="small" onClick={() => handleCopy(m.id, m.content)} sx={{ p: 0.25 }}>
                      {copiedId === m.id ? <CheckRounded sx={{ fontSize: 14, color: 'success.main' }} /> : <ContentCopyRounded sx={{ fontSize: 14 }} />}
                    </IconButton>
                  </Stack>
                )}

                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontSize: 13,
                    lineHeight: 1.6,
                    '& strong': { fontWeight: 700 },
                    '& h3': { fontSize: 13.5, fontWeight: 800, mt: 1, mb: 0.5 },
                  }}
                >
                  {m.content}
                </Typography>

                {/* Suggested Issue Links */}
                {m.suggestedIssues && m.suggestedIssues.length > 0 && (
                  <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                    {m.suggestedIssues.map((key) => {
                      const matched = issues.find((i) => i.key.toUpperCase() === key.toUpperCase())
                      return (
                        <Chip
                          key={key}
                          label={key}
                          size="small"
                          color="primary"
                          variant="outlined"
                          onClick={() => {
                            if (matched) {
                              selectIssue(matched.id)
                            }
                          }}
                          clickable
                          sx={{ fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}
                        />
                      )
                    })}
                  </Stack>
                )}
              </Paper>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, px: 0.5, textAlign: isUser ? 'right' : 'left', fontSize: 10 }}>
                {m.timestamp}
              </Typography>
            </Box>
          )
        })}

        {loading && (
          <Box sx={{ alignSelf: 'flex-start', p: 1.5, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <CircularProgress size={16} sx={{ color: '#8F44FD' }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Rovo is analyzing project data...
              </Typography>
            </Stack>
          </Box>
        )}
      </Box>

      {/* INPUT BAR */}
      <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ask Rovo anything about your Jira work..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            slotProps={{
              input: {
                sx: { fontSize: 13, borderRadius: 1.5 },
              },
            }}
          />
          <Button
            variant="contained"
            color="primary"
            disabled={!input.trim() || loading}
            onClick={() => handleSend()}
            sx={{
              minWidth: 42,
              height: 40,
              px: 0,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, #8F44FD 0%, #0052CC 100%)',
            }}
          >
            <SendRounded fontSize="small" />
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontSize: 10.5, textAlign: 'center' }}>
          Powered by Atlassian Intelligence · Privacy protected
        </Typography>
      </Box>
    </Drawer>
  )
}
