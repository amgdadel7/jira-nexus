import { Component, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'

interface Props {
  children: ReactNode
}

interface State {
  message: string | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { message: null }

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message || 'Something went wrong' }
  }

  render() {
    if (!this.state.message) return this.props.children
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Box sx={{ maxWidth: 440 }}>
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {this.state.message}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Reload the page. If you were signed in, try zoe.m@example.net / demo1234.
          </Typography>
          <Button variant="contained" onClick={() => window.location.assign('/login')}>
            Open sign in
          </Button>
        </Box>
      </Box>
    )
  }
}
