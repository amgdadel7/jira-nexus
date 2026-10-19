import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import { useTranslation } from 'react-i18next'
import { GoogleMark, MicrosoftMark } from './oauth_provider_marks'

interface OauthProviderButtonsProps {
  isBusy: boolean
  onGoogle: () => void
  onMicrosoft: () => void
}

export function OauthProviderButtons({ isBusy, onGoogle, onMicrosoft }: OauthProviderButtonsProps) {
  const { t } = useTranslation()
  return (
    <Stack spacing={1.25} sx={{ mb: 2 }}>
      <Button variant="outlined" size="large" startIcon={<GoogleMark />} onClick={onGoogle} disabled={isBusy}>
        {t('auth.google')}
      </Button>
      <Button variant="outlined" size="large" startIcon={<MicrosoftMark />} onClick={onMicrosoft} disabled={isBusy}>
        {t('auth.microsoft')}
      </Button>
    </Stack>
  )
}
