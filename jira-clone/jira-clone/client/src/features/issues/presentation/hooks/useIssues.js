import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { issuesApi } from '../../data/issuesApi'

export function useIssueSearch(jql, opts = {}) {
  return useQuery({
    queryKey: ['issues', 'search', jql, opts],
    queryFn: () => issuesApi.search(jql, opts),
    enabled: typeof jql === 'string',
  })
}

export function useIssue(key) {
  return useQuery({
    queryKey: ['issue', key],
    queryFn: () => issuesApi.issue(key),
    enabled: !!key,
  })
}

export function useUpdateIssue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ key, fields }) => issuesApi.update(key, fields),
    onSuccess: (updatedIssue, { key }) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      queryClient.setQueryData(['issue', key], (old) => (old ? { ...old, ...updatedIssue } : updatedIssue))
    },
  })
}

export function useCreateIssue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fields) => issuesApi.create(fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] })
    },
  })
}
