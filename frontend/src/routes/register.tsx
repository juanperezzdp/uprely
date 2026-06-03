import { Suspense, lazy } from 'react'

const RegisterPage = lazy(() =>
  import('@/features/auth/pages/register-page').then((module) => ({
    default: module.RegisterPage,
  })),
)

export function RegisterRouteComponent() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <RegisterPage />
    </Suspense>
  )
}

function RouteFallback() {
  return (
    <div className="h-[32rem] animate-pulse rounded-sm border border-border bg-card" />
  )
}
