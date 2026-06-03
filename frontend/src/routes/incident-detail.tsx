import { Suspense, lazy } from 'react'

const IncidentDetailPage = lazy(() =>
  import('@/features/incidents/pages/incident-detail-page').then((module) => ({
    default: module.IncidentDetailPage,
  })),
)

export function IncidentDetailRouteComponent() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <IncidentDetailPage />
    </Suspense>
  )
}

function RouteFallback() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="h-72 animate-pulse rounded-sm border border-border bg-card" />
      <div className="h-72 animate-pulse rounded-sm border border-border bg-card" />
    </div>
  )
}
