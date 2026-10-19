import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export function LoginHeroPanel() {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  return (
    <Box
      sx={{
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        justifyContent: 'flex-end',
        p: 5,
        background: 'linear-gradient(165deg, #0B3D3A 0%, #10232B 55%, #071412 100%)',
        color: '#E8F3EF',
      }}
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <Typography className="mono" sx={{ mb: 2, opacity: 0.7 }}>
          {t('auth.kicker')}
        </Typography>
        <Typography variant="h3" sx={{ fontSize: 36, fontWeight: 700, maxWidth: 380, color: '#E8F3EF' }}>
          {t('auth.headline')}
        </Typography>
        <Typography sx={{ mt: 2, maxWidth: 400, color: '#9BB8B0' }}>{t('auth.pitch')}</Typography>
      </motion.div>
    </Box>
  )
}
