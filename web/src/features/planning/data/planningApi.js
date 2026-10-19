import { req, q } from '../../../core/api/httpClient'
import { getProject } from '../../../core/api/sessionStore'

export const planningApi = {
  // sprints
  sprints: (state, project = getProject()) => req('GET', `/api/sprints${q({ project, state })}`),
  createSprint: (fields) => req('POST', '/api/sprints', { projectKey: getProject(), ...fields }),
  updateSprint: (id, fields) => req('PATCH', `/api/sprints/${id}`, fields),
  startSprint: (id, body) => req('POST', `/api/sprints/${id}/start`, body),
  completeSprint: (id, body) => req('POST', `/api/sprints/${id}/complete`, body),
  deleteSprint: (id) => req('DELETE', `/api/sprints/${id}`),

  // versions
  versions: (status, project = getProject()) => req('GET', `/api/versions${q({ project, status })}`),
  version: (id) => req('GET', `/api/versions/${id}`),
  createVersion: (fields) => req('POST', '/api/versions', { projectKey: getProject(), ...fields }),
  updateVersion: (id, fields) => req('PATCH', `/api/versions/${id}`, fields),
  releaseVersion: (id, body) => req('POST', `/api/versions/${id}/release`, body),
  deleteVersion: (id, moveTo = null) => req('DELETE', `/api/versions/${id}`, { moveTo }),

  // components
  components: (project = getProject()) => req('GET', `/api/components${q({ project })}`),
  createComponent: (fields) => req('POST', '/api/components', { projectKey: getProject(), ...fields }),
  updateComponent: (id, fields) => req('PATCH', `/api/components/${id}`, fields),
  deleteComponent: (id) => req('DELETE', `/api/components/${id}`),
}
