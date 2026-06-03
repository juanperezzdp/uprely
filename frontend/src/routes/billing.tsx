import { Suspense, lazy } from 'react'

const BillingPage = lazy(() =>
  import('@/features/billing/pages/billing-page').then((module) => ({
    default: module.BillingPage,
  })),
)

export function BillingRouteComponent() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <BillingPage />
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
