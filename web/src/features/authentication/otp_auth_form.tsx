import type { FormEvent } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import { useTranslation } from 'react-i18next'

interface OtpAuthFormProps {
  mode: 'signin' | 'signup'
  name: string
  email: string
  code: string
  isOtpSent: boolean
  isBusy: boolean
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onCodeChange: (value: string) => void
  onSendCode: () => void
  onSubmit: (event: FormEvent) => void
  onUsePassword: () => void
}

export function OtpAuthForm({
  mode,
  name,
  email,
  code,
  isOtpSent,
  isBusy,
  onNameChange,
  onEmailChange,
  onCodeChange,
  onSendCode,
  onSubmit,
  onUsePassword,
}: OtpAuthFormProps) {
  const { t } = useTranslation()

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Stack spacing={2}>
        {mode === 'signup' && (
          <TextField
            label={t('auth.name')}
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            fullWidth
          />
        )}
        <TextField
          label={t('auth.email')}
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          fullWidth
        />
        {isOtpSent && (
          <TextField
            label={t('auth.code')}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            slotProps={{ htmlInput: { inputMode: 'numeric', autoComplete: 'one-time-code', maxLength: 6 } }}
            required
            fullWidth
            helperText={t('auth.otpSent', { email })}
          />
        )}
        {!isOtpSent ? (
          <Button type="button" variant="contained" size="large" onClick={onSendCode} disabled={isBusy}>
            {t('auth.sendCode')}
          </Button>
        ) : (
          <Button type="submit" variant="contained" size="large" disabled={isBusy || code.length < 4}>
            {t('auth.verify')}
          </Button>
        )}
        <Button type="button" onClick={onUsePassword}>
          {t('auth.usePassword')}
        </Button>
      </Stack>
    </Box>
  )
}
