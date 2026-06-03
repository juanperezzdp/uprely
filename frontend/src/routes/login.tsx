import { Suspense, lazy } from 'react'

const LoginPage = lazy(() =>
  import('@/features/auth/pages/login-page').then((module) => ({
    default: module.LoginPage,
  })),
)

export function LoginRouteComponent() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <LoginPage />
    </Suspense>
  )
}

function RouteFallback() {
  return (
    <div className="h-[32rem] animate-pulse rounded-sm border border-border bg-card" />
  )
}
