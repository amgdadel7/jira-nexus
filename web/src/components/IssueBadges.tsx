import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import BookmarkRounded from '@mui/icons-material/BookmarkRounded'
import CheckBoxOutlined from '@mui/icons-material/CheckBoxOutlined'
import BugReportRounded from '@mui/icons-material/BugReportRounded'
import FlashOnRounded from '@mui/icons-material/FlashOnRounded'
import SubdirectoryArrowRightRounded from '@mui/icons-material/SubdirectoryArrowRightRounded'
import KeyboardArrowUpRounded from '@mui/icons-material/KeyboardArrowUpRounded'
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded'
import KeyboardDoubleArrowUpRounded from '@mui/icons-material/KeyboardDoubleArrowUpRounded'
import KeyboardDoubleArrowDownRounded from '@mui/icons-material/KeyboardDoubleArrowDownRounded'
import RemoveRounded from '@mui/icons-material/RemoveRounded'
import { IssueType, Priority } from '@/types'

const TYPE_META: Record<IssueType, { label: string; color: string; Icon: typeof BugReportRounded }> = {
  [IssueType.Epic]: { label: 'Epic', color: '#904EE2', Icon: FlashOnRounded },
  [IssueType.Story]: { label: 'Story', color: '#22A06B', Icon: BookmarkRounded },
  [IssueType.Task]: { label: 'Task', color: '#0C66E4', Icon: CheckBoxOutlined },
  [IssueType.Bug]: { label: 'Bug', color: '#C9372C', Icon: BugReportRounded },
  [IssueType.Subtask]: { label: 'Subtask', color: '#5E6C84', Icon: SubdirectoryArrowRightRounded },
}

const PRI_META: Record<Priority, { label: string; color: string; Icon: typeof RemoveRounded }> = {
  [Priority.Lowest]: { label: 'Lowest', color: '#5E6C84', Icon: KeyboardDoubleArrowDownRounded },
  [Priority.Low]: { label: 'Low', color: '#1D9AAA', Icon: KeyboardArrowDownRounded },
  [Priority.Medium]: { label: 'Medium', color: '#E2B203', Icon: RemoveRounded },
  [Priority.High]: { label: 'High', color: '#E56910', Icon: KeyboardArrowUpRounded },
  [Priority.Critical]: { label: 'Critical', color: '#C9372C', Icon: KeyboardDoubleArrowUpRounded },
}

export function TypeIcon({ type, size = 16 }: { type: IssueType; size?: number }) {
  const m = TYPE_META[type]
  return (
    <Tooltip title={m.label}>
      <Box component="span" sx={{ display: 'inline-flex', color: m.color, lineHeight: 0 }}>
        <m.Icon sx={{ fontSize: size }} />
      </Box>
    </Tooltip>
  )
}

export function PriorityIcon({ priority, size = 16 }: { priority: Priority; size?: number }) {
  const m = PRI_META[priority]
  return (
    <Tooltip title={m.label}>
      <Box component="span" sx={{ display: 'inline-flex', color: m.color, lineHeight: 0 }}>
        <m.Icon sx={{ fontSize: size }} />
      </Box>
    </Tooltip>
  )
}

export { TYPE_META, PRI_META }
