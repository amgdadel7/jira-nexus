import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import { motion, useReducedMotion } from 'framer-motion'

export function InsightCard({ title, body }: { title: string; body: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
    >
      <Card
        sx={{
          p: 2,
          background: (th) =>
            th.palette.mode === 'dark'
              ? 'linear-gradient(135deg, #10211E 0%, #0E3B36 100%)'
              : 'linear-gradient(135deg, #FFFFFF 0%, #E7F6F3 100%)',
          borderColor: 'primary.main',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <AutoAwesomeOutlined fontSize="small" aria-hidden />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {body}
            </Typography>
          </Box>
        </Stack>
      </Card>
    </motion.div>
  )
}
