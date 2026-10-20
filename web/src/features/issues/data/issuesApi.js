import { req, q } from '../../../core/api/httpClient'

export const issuesApi = {
  search: (jql, opts = {}) => req('GET', `/api/search${q({ jql, ...opts })}`),
  issue: (key) => req('GET', `/api/issues/${key}`),
  create: (fields) => req('POST', '/api/issues', fields),
  update: (key, fields) => req('PATCH', `/api/issues/${key}`, fields),
  remove: (key) => req('DELETE', `/api/issues/${key}`),
  clone: (key) => req('POST', `/api/issues/${key}/clone`),
  bulk: (payload) => req('POST', '/api/issues/bulk', payload),
  rank: async (key, pos) => {
    try {
      return await req('PUT', `/api/issues/${key}/rank`, pos)
    } catch (err) {
      if (err?.status === 405) {
        return await req('POST', `/api/issues/${key}/rank`, pos)
      }
      throw err
    }
  },
  addComment: (key, body) => req('POST', `/api/issues/${key}/comments`, { body }),
  editComment: (id, body) => req('PATCH', `/api/comments/${id}`, { body }),
  deleteComment: (id) => req('DELETE', `/api/comments/${id}`),
  watch: (key) => req('POST', `/api/issues/${key}/watch`),
  unwatch: (key) => req('DELETE', `/api/issues/${key}/watch`),
  addLink: (key, type, targetKey, direction) => req('POST', `/api/issues/${key}/links`, { type, targetKey, direction }),
  removeLink: (id) => req('DELETE', `/api/links/${id}`),
  upload: (key, file) =>
    req('POST', `/api/issues/${key}/attachments`, file, {
      raw: true,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name),
      },
    }),
  deleteAttachment: (id) => req('DELETE', `/api/attachments/${id}`),
  vote: (key) => req('POST', `/api/issues/${key}/votes`),
  unvote: (key) => req('DELETE', `/api/issues/${key}/votes`),
  voters: (key) => req('GET', `/api/issues/${key}/votes`),
}
