import { Suspense, lazy } from 'react'

const OverviewPage = lazy(() =>
  import('@/features/system/pages/overview-page').then((module) => ({
    default: module.OverviewPage,
  })),
)

export function IndexRouteComponent() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <OverviewPage />
    </Suspense>
  )
}

function RouteFallback() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          className="h-40 animate-pulse rounded-sm border border-border bg-card"
          key={index}
        />
      ))}
    </div>
  )
}
