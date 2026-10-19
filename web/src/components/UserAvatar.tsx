import Avatar from '@mui/material/Avatar'
import Tooltip from '@mui/material/Tooltip'
import { initials } from '@/formatting/display_text'
import { useCatalogStore } from '@/store/catalogStore'
import type { User } from '@/types'

interface Props {
  user?: User | null
  userId?: string
  size?: number
  showTooltip?: boolean
}

export function UserAvatar({ user, userId, size = 28, showTooltip = true }: Props) {
  const fromStore = useCatalogStore((s) => (userId ? s.users.find((x) => x.id === userId) : undefined))
  const u = user ?? fromStore
  if (!u) {
    return (
      <Avatar sx={{ width: size, height: size, fontSize: size * 0.38, bgcolor: '#6B778C' }}>
        ?
      </Avatar>
    )
  }
  const av = (
    <Avatar
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        fontWeight: 700,
        bgcolor: u.color,
        color: '#fff',
      }}
    >
      {initials(u.name)}
    </Avatar>
  )
  return showTooltip ? <Tooltip title={`${u.name} · ${u.title}`}>{av}</Tooltip> : av
}
