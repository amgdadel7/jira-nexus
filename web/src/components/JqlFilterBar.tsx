import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import InputAdornment from '@mui/material/InputAdornment'
import Tooltip from '@mui/material/Tooltip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'

// Icons
import SearchRounded from '@mui/icons-material/SearchRounded'
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded'
import BookmarkBorderRounded from '@mui/icons-material/BookmarkBorderRounded'
import CodeRounded from '@mui/icons-material/CodeRounded'
import ClearRounded from '@mui/icons-material/ClearRounded'

interface Props {
  isJqlMode: boolean
  onToggleMode: (jql: boolean) => void
  onApplyJql: (query: string) => void
  currentQuery: string
}

const PRESET_JQL_QUERIES = [
  { label: 'My open issues', jql: 'assignee = currentUser() AND status != Done' },
  { label: 'High priority bugs', jql: 'type = Bug AND priority in (High, Highest)' },
  { label: 'In Progress work', jql: 'status = "In Progress" ORDER BY rank ASC' },
  { label: 'Recently updated', jql: 'ORDER BY updated DESC' },
  { label: 'Sub-tasks only', jql: 'type = Subtask' },
]

export function JqlFilterBar({ isJqlMode, onToggleMode, onApplyJql, currentQuery }: Props) {
  const [jqlText, setJqlText] = useState(currentQuery || '')
  const [presetsAnchor, setPresetsAnchor] = useState<HTMLElement | null>(null)

  // Basic syntax check: must not end with dangling AND / OR
  const isValid = !jqlText.trim().match(/(AND|OR|=|,)\s*$/i)

  const handleRun = () => {
    onApplyJql(jqlText)
  }

  const handleSelectPreset = (jql: string) => {
    setJqlText(jql)
    onApplyJql(jql)
    setPresetsAnchor(null)
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', width: '100%' }}>
        {/* JQL Mode Switch Button */}
        <Button
          size="small"
          variant={isJqlMode ? 'contained' : 'outlined'}
          color={isJqlMode ? 'primary' : 'inherit'}
          startIcon={<CodeRounded sx={{ fontSize: 16 }} />}
          onClick={() => onToggleMode(!isJqlMode)}
          sx={{
            fontWeight: 700,
            fontSize: 12,
            minWidth: 80,
            textTransform: 'none',
            height: 36,
          }}
        >
          {isJqlMode ? 'JQL Active' : 'Switch to JQL'}
        </Button>

        {isJqlMode && (
          <>
            {/* JQL Search Input */}
            <TextField
              size="small"
              fullWidth
              value={jqlText}
              onChange={(e) => setJqlText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleRun()
                }
              }}
              placeholder='e.g. project = KAN AND status = "In Progress" ORDER BY created DESC'
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        {jqlText && (
                          <Tooltip title="Clear JQL">
                            <Box
                              component="span"
                              onClick={() => {
                                setJqlText('')
                                onApplyJql('')
                              }}
                              sx={{ cursor: 'pointer', display: 'flex', color: 'text.disabled' }}
                            >
                              <ClearRounded sx={{ fontSize: 16 }} />
                            </Box>
                          </Tooltip>
                        )}
                        <Tooltip title={isValid ? 'JQL Syntax Valid' : 'Incomplete JQL expression'}>
                          <Box component="span" sx={{ display: 'flex' }}>
                            {isValid ? (
                              <CheckCircleRounded sx={{ fontSize: 16, color: 'success.main' }} />
                            ) : (
                              <ErrorOutlineRounded sx={{ fontSize: 16, color: 'warning.main' }} />
                            )}
                          </Box>
                        </Tooltip>
                      </Stack>
                    </InputAdornment>
                  ),
                  sx: {
                    fontFamily: '"Fira Code", monospace',
                    fontSize: 13,
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                  },
                },
              }}
            />

            {/* Run Query Button */}
            <Button
              size="small"
              variant="contained"
              onClick={handleRun}
              sx={{ height: 36, px: 2, fontWeight: 700, textTransform: 'none' }}
            >
              Search
            </Button>

            {/* Saved / Preset JQL Filters */}
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<BookmarkBorderRounded sx={{ fontSize: 16 }} />}
              onClick={(e) => setPresetsAnchor(e.currentTarget)}
              sx={{ height: 36, px: 1.5, fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              Presets
            </Button>
            <Menu anchorEl={presetsAnchor} open={Boolean(presetsAnchor)} onClose={() => setPresetsAnchor(null)}>
              <Typography variant="caption" sx={{ px: 2, py: 0.75, display: 'block', fontWeight: 700, color: 'text.secondary' }}>
                STARRED JQL PRESETS
              </Typography>
              {PRESET_JQL_QUERIES.map((p, idx) => (
                <MenuItem key={idx} onClick={() => handleSelectPreset(p.jql)} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>
                    {p.label}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: 11 }}>
                    {p.jql}
                  </Typography>
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
      </Stack>
    </Box>
  )
}
