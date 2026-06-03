import { redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { authSessionQueryOptions } from '@/services/auth/auth-service'

export async function requireAuth(queryClient: QueryClient) {
  const user = await queryClient.ensureQueryData(authSessionQueryOptions())

  if (!user) {
    throw redirect({
      to: '/login',
    })
  }

  return user
}

export async function redirectIfAuthenticated(queryClient: QueryClient) {
  const user = await queryClient.ensureQueryData(authSessionQueryOptions())

  if (user) {
    throw redirect({
      to: '/dashboard',
    })
  }
}
