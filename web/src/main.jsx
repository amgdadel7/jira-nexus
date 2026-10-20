import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import mirat from './mirat.js'
import App from './App.jsx'
import './index.css'
import { installTooltips } from './motion.js'

const miratDsn = import.meta.env.VITE_MIRAT_DSN || 'https://mirat-monitor.onrender.com/api/events/S3reV9dc_WwNhtiNrQM7PRILQMZD_myf'
mirat.init(miratDsn, {
  environment: import.meta.env.MODE || 'production',
  release: '1.0.0'
})

const sentryDsn = import.meta.env.VITE_SENTRY_DSN

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

installTooltips()


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
