import { req, q } from '../../../core/api/httpClient'
import { getProject } from '../../../core/api/sessionStore'

export const projectsApi = {
  projects: (search) => req('GET', `/api/projects${q({ q: search })}`),
  project: (key = getProject()) => req('GET', `/api/projects/${key}`),
  createProject: (fields) => req('POST', '/api/projects', fields),
  updateProject: (fields, key = getProject()) => req('PATCH', `/api/projects/${key}`, fields),
  renameProject: (name, key = getProject()) => req('PATCH', `/api/projects/${key}`, { name }),
  deleteProject: (key, confirm) => req('DELETE', `/api/projects/${key}`, { confirm }),
  starProject: (key, on) => req(on ? 'POST' : 'DELETE', `/api/projects/${key}/star`),
}
