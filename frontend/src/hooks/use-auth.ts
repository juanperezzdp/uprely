import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authQueryKey, authService, authSessionQueryOptions } from '@/services/auth/auth-service'

export function useAuth() {
  const queryClient = useQueryClient()
  const sessionQuery = useQuery(authSessionQueryOptions())
  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.setQueryData(authQueryKey, null)
      toast.success('You have been signed out.')
    },
    onError: () => {
      toast.error('Unable to sign out. Please try again.')
    },
  })

  return {
    user: sessionQuery.data ?? null,
    isAuthenticated: Boolean(sessionQuery.data),
    isLoading: sessionQuery.isLoading,
    isFetching: sessionQuery.isFetching,
    error: sessionQuery.error,
    refresh: () => queryClient.invalidateQueries({ queryKey: authQueryKey }),
    logout: () => logoutMutation.mutateAsync(),
    isLoggingOut: logoutMutation.isPending,
  }
}
