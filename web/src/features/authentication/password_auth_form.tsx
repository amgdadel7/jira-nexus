import type { FormEvent } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import { useTranslation } from 'react-i18next'

interface PasswordAuthFormProps {
  mode: 'signin' | 'signup'
  name: string
  email: string
  password: string
  isBusy: boolean
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onUseOtp: () => void
}

export function PasswordAuthForm({
  mode,
  name,
  email,
  password,
  isBusy,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onUseOtp,
}: PasswordAuthFormProps) {
  const { t } = useTranslation()
  const isSignup = mode === 'signup'
  const canSubmitSignup = name.trim() && email.trim() && password.length >= 6

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Stack spacing={2}>
        {isSignup && (
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
        <TextField
          label={t('auth.password')}
          type="password"
          name="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          fullWidth
          helperText={isSignup ? t('auth.passwordHint') : t('auth.helper')}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isBusy || (isSignup && !canSubmitSignup)}
        >
          {isSignup ? t('auth.signup') : t('auth.signIn')}
        </Button>
        <Button type="button" onClick={onUseOtp}>
          {t('auth.useOtp')}
        </Button>
      </Stack>
    </Box>
  )
}
