import { Suspense, lazy } from 'react'

const AlertsPage = lazy(() =>
  import('@/features/alerts/pages/alerts-page').then((module) => ({
    default: module.AlertsPage,
  })),
)

export function AlertsRouteComponent() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <AlertsPage />
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
