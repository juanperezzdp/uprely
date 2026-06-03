import { Suspense, lazy } from 'react'

const StatusPagesPage = lazy(() =>
  import('@/features/status-pages/pages/status-pages-page').then((module) => ({
    default: module.StatusPagesPage,
  })),
)

export function StatusPagesRouteComponent() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <StatusPagesPage />
    </Suspense>
  )
}

function RouteFallback() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="h-72 animate-pulse rounded-sm border border-border bg-card" />
      <div className="h-72 animate-pulse rounded-sm border border-border bg-card" />
    </div>
  )
}
