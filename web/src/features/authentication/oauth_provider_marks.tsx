import Box from '@mui/material/Box'

export function GoogleMark() {
  return (
    <Box component="span" sx={{ width: 18, height: 18, display: 'inline-flex' }} aria-hidden>
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path
          fill="#EA4335"
          d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1-.2-1.5H12z"
        />
      </svg>
    </Box>
  )
}

export function MicrosoftMark() {
  return (
    <Box component="span" sx={{ width: 16, height: 16, display: 'inline-flex' }} aria-hidden>
      <svg viewBox="0 0 23 23" width="16" height="16">
        <path fill="#F25022" d="M1 1h10v10H1z" />
        <path fill="#7FBA00" d="M12 1h10v10H12z" />
        <path fill="#00A4EF" d="M1 12h10v10H1z" />
        <path fill="#FFB900" d="M12 12h10v10H12z" />
      </svg>
    </Box>
  )
}
