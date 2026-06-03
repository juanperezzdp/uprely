import { Suspense, lazy } from 'react'

const IncidentsPage = lazy(() =>
  import('@/features/incidents/pages/incidents-page').then((module) => ({
    default: module.IncidentsPage,
  })),
)

export function IncidentsRouteComponent() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <IncidentsPage />
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
