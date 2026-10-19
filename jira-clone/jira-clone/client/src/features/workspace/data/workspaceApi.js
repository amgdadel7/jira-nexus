import { req, q } from '../../../core/api/httpClient'
import { getProject } from '../../../core/api/sessionStore'

export const workspaceApi = {
  meta: (project = getProject()) => req('GET', `/api/meta${q({ project })}`),
  quicksearch: (qStr) => req('GET', `/api/quicksearch${q({ q: qStr })}`),
  preferences: () => req('GET', '/api/auth/me/preferences'),
  savePreferences: (fields) => req('PATCH', '/api/auth/me/preferences', fields),
  plans: () => req('GET', '/api/plans'),
  billing: () => req('GET', '/api/billing'),
}
