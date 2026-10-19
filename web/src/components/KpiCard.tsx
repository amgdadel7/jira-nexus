import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { AnimatedNumber } from '@/components/widgets/AnimatedNumber'

interface Props {
  title: string
  value: string | number
  delta: number
  icon?: ReactNode
  color?: string
  spark?: number[]
  target?: string
  suffix?: string
}

export function KpiCard({ title, value, delta, icon, target, suffix = '' }: Props) {
  const up = delta >= 0
  const reduce = useReducedMotion()
  const numeric = typeof value === 'number'
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      style={{ flex: 1, minWidth: 140 }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          height: '100%',
          borderInlineEnd: 1,
          borderColor: 'divider',
          '&:last-of-type': { borderInlineEnd: 0 },
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          {icon && (
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 1,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                display: 'grid',
                placeItems: 'center',
                '& svg': { fontSize: 16 },
              }}
              aria-hidden
            >
              {icon}
            </Box>
          )}
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
          <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
            {numeric ? <AnimatedNumber value={value} suffix={suffix} /> : value}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: up ? 'success.main' : 'error.main', fontWeight: 700 }}
          >
            {up ? '+' : ''}
            {delta}%
          </Typography>
        </Stack>
        {target && (
          <Typography variant="caption" color="text.secondary">
            {target}
          </Typography>
        )}
      </Box>
    </motion.div>
  )
}
