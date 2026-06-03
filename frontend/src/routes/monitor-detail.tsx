import { Suspense, lazy } from 'react'

const MonitorDetailPage = lazy(() =>
  import('@/features/monitors/pages/monitor-detail-page').then((module) => ({
    default: module.MonitorDetailPage,
  })),
)

export function MonitorDetailRouteComponent() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <MonitorDetailPage />
    </Suspense>
  )
}

function RouteFallback() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
      <div className="h-72 animate-pulse rounded-sm border border-border bg-card" />
      <div className="h-72 animate-pulse rounded-sm border border-border bg-card" />
    </div>
  )
}
