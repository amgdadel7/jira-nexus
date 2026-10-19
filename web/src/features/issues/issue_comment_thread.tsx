import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from '@/components/UserAvatar'
import { userById } from '@/store/catalogStore'
import { fromNow } from '@/formatting/display_text'
import type { Comment, User } from '@/types'

interface IssueCommentThreadProps {
  issueId: string
  comments: Comment[]
  currentUser: User | null
  onAddComment: (issueId: string, authorId: string, body: string) => void
}

export function IssueCommentThread({ issueId, comments, currentUser, onAddComment }: IssueCommentThreadProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')

  const publish = () => {
    if (!currentUser || !draft.trim()) return
    onAddComment(issueId, currentUser.id, draft.trim())
    setDraft('')
  }

  return (
    <>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t('issue.comments')}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <UserAvatar user={currentUser} size={32} />
        <TextField
          fullWidth
          size="small"
          placeholder={t('issue.commentPh')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && draft.trim() && currentUser) {
              e.preventDefault()
              publish()
            }
          }}
        />
        <Button variant="contained" disabled={!draft.trim()} onClick={publish}>
          {t('issue.post')}
        </Button>
      </Stack>
      <Stack spacing={1.5}>
        {comments.map((comment) => (
          <Stack key={comment.id} direction="row" spacing={1.25}>
            <UserAvatar userId={comment.authorId} size={28} />
            <Box>
              <Typography variant="body2">
                <b>{userById(comment.authorId)?.name}</b>{' '}
                <Box component="span" color="text.secondary">
                  {fromNow(comment.createdAt)}
                </Box>
              </Typography>
              <Typography variant="body2">{comment.body}</Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    </>
  )
}
