export type UserPlan = 'FREE' | 'PRO'

export type AuthenticatedUser = {
  id: string
  email: string
  plan: UserPlan
  dodoCustomerId: string | null
}

export type AuthResponse = {
  user: AuthenticatedUser
}

export type LoginPayload = {
  email: string
  password: string
}

export type RegisterPayload = {
  email: string
  password: string
}

export type LogoutResponse = {
  message: string
}
