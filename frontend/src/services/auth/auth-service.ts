import { queryOptions } from '@tanstack/react-query'
import { apiClient, ApiError } from '@/services/http/api-client'
import type {
  AuthenticatedUser,
  AuthResponse,
  LoginPayload,
  LogoutResponse,
  RegisterPayload,
} from '@/types/auth'

export const authQueryKey = ['auth', 'session'] as const

export const authService = {
  async login(payload: LoginPayload): Promise<AuthenticatedUser> {
    const response = await apiClient<AuthResponse>('/auth/login', {
      method: 'POST',
      body: payload,
    })

    return response.user
  },

  async register(payload: RegisterPayload): Promise<AuthenticatedUser> {
    const response = await apiClient<AuthResponse>('/auth/register', {
      method: 'POST',
      body: payload,
    })

    return response.user
  },

  async logout(): Promise<LogoutResponse> {
    return apiClient<LogoutResponse>('/auth/logout', {
      method: 'POST',
    })
  },

  async getSession(): Promise<AuthenticatedUser | null> {
    try {
      return await apiClient<AuthenticatedUser>('/auth/me')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return null
      }

      throw error
    }
  },
}

export function authSessionQueryOptions() {
  return queryOptions({
    queryKey: authQueryKey,
    queryFn: () => authService.getSession(),
    staleTime: 60_000,
    retry: false,
  })
}
