import { Suspense, lazy } from 'react'

const PublicStatusPage = lazy(() =>
  import('@/features/status-pages/pages/public-status-page').then((module) => ({
    default: module.PublicStatusPage,
  })),
)

export function PublicStatusRouteComponent() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <PublicStatusPage />
    </Suspense>
  )
}

function RouteFallback() {
  return <div className="h-screen animate-pulse bg-background" />
}
