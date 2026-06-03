import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  History,
  ShieldAlert,
  TimerReset,
} from 'lucide-react'
import { useMemo } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { PageFeedback } from '@/components/app/page-feedback'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  formatIncidentDateTime,
  getIncidentDuration,
  getIncidentStatusClasses,
} from '@/features/incidents/lib/incident-formatters'
import { cn } from '@/lib/cn'
import { incidentDetailQueryOptions } from '@/services/incidents/incident-service'
import {
  monitorChecksPageQueryOptions,
  monitorDetailQueryOptions,
} from '@/services/monitors/monitor-service'

export function IncidentDetailPage() {
  const router = useRouter()
  const { id } = useParams({ from: '/incidents/$id' })
  const incidentQuery = useQuery(incidentDetailQueryOptions(id))
  const incident = incidentQuery.data
  const monitorQuery = useQuery({
    ...monitorDetailQueryOptions(incident?.monitorId ?? 'missing-monitor'),
    enabled: Boolean(incident?.monitorId),
  })
  const contextualChecksQuery = useQuery({
    ...monitorChecksPageQueryOptions({
      monitorId: incident?.monitorId ?? 'missing-monitor',
      page: 1,
      limit: 100,
    }),
    enabled: Boolean(incident?.monitorId),
  })

  const contextualChecks = useMemo(() => {
    if (!incident) {
      return []
    }

    const startAt = new Date(incident.startedAt).getTime() - 6 * 60 * 60 * 1000
    const endAt = incident.resolvedAt
      ? new Date(incident.resolvedAt).getTime() + 6 * 60 * 60 * 1000
      : Number.POSITIVE_INFINITY

    const matchingChecks = (contextualChecksQuery.data?.items ?? []).filter((check) => {
      const checkedAt = new Date(check.checkedAt).getTime()

      return checkedAt >= startAt && checkedAt <= endAt
    })

    return matchingChecks.length > 0
      ? matchingChecks
      : (contextualChecksQuery.data?.items ?? []).slice(0, 12)
  }, [contextualChecksQuery.data, incident])

  if (incidentQuery.isError) {
    return (
      <AppShell activeSection="incidents">
        <PageFeedback
          action={
            <Button className="rounded-sm" onClick={() => void incidentQuery.refetch()}>
              Retry loading incident
            </Button>
          }
          description="The incident detail could not be loaded from the API."
          title="Unable to load incident"
          variant="error"
        />
      </AppShell>
    )
  }

  if (incidentQuery.isLoading && !incident) {
    return (
      <AppShell activeSection="incidents">
        <PageFeedback
          description="Loading incident lifecycle, related monitor and contextual checks."
          title="Loading incident"
          variant="loading"
        />
      </AppShell>
    )
  }

  return (
    <AppShell
      activeSection="incidents"
      headerActions={
        <>
          <Button
            className="rounded-sm"
            onClick={() => void router.navigate({ to: '/incidents' })}
            variant="outline"
          >
            <ArrowLeft className="size-4" />
            Back to incidents
          </Button>
          {incident?.monitorId ? (
            <Button
              className="rounded-sm"
              onClick={() =>
                void router.navigate({
                  to: '/monitors/$id',
                  params: { id: incident.monitorId },
                })
              }
              variant="outline"
            >
              <ShieldAlert className="size-4" />
              Open monitor
            </Button>
          ) : null}
        </>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-sm border border-border bg-card px-7 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/10 px-3 py-1.5">
            <AlertTriangle className="size-4 text-primary" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              Incident Detail
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {incident?.cause ?? 'Loading incident...'}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">
              Monitor: {monitorQuery.data?.name ?? incident?.monitorId ?? '--'}
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <OverviewTile
              label="Status"
              value={incident?.status ?? '--'}
            />
            <OverviewTile
              label="Duration"
              value={incident ? getIncidentDuration(incident) : '--'}
            />
            <OverviewTile
              label="Started"
              value={incident ? formatIncidentDateTime(incident.startedAt) : '--'}
            />
          </div>
        </div>

        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle>Lifecycle</CardTitle>
            <CardDescription>Primary timestamps and current status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailItem label="Started at" value={formatIncidentDateTime(incident?.startedAt ?? null)} />
            <DetailItem label="Confirmed at" value={formatIncidentDateTime(incident?.confirmedAt ?? null)} />
            <DetailItem label="Resolved at" value={formatIncidentDateTime(incident?.resolvedAt ?? null)} />
            <div className="rounded-sm border border-border bg-background px-4 py-3">
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="mt-2">
                <span className={getIncidentStatusClasses(incident?.status ?? 'OPEN')}>
                  {incident?.status ?? '--'}
                </span>
              </dd>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={TimerReset} label="Duration" value={incident ? getIncidentDuration(incident) : '--'} />
        <MetricCard
          icon={History}
          label="Contextual checks"
          value={String(contextualChecks.length)}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Cause"
          value={incident?.cause ? 'Tracked' : '--'}
        />
        <MetricCard
          icon={ShieldAlert}
          label="Monitor"
          value={monitorQuery.data?.type ?? '--'}
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle>Incident History</CardTitle>
            <CardDescription>
              Timeline assembled from incident dates and surrounding monitor checks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <HistoryStep
              description={formatIncidentDateTime(incident?.startedAt ?? null)}
              label="Incident opened"
              tone="danger"
            />
            {incident?.confirmedAt ? (
              <HistoryStep
                description={formatIncidentDateTime(incident.confirmedAt)}
                label="Incident confirmed"
                tone="warning"
              />
            ) : null}
            {incident?.resolvedAt ? (
              <HistoryStep
                description={formatIncidentDateTime(incident.resolvedAt)}
                label="Incident resolved"
                tone="success"
              />
            ) : (
              <HistoryStep
                description="Still open"
                label="Awaiting recovery"
                tone="danger"
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle>Contextual Checks</CardTitle>
            <CardDescription>
              Nearby checks around the incident window for troubleshooting context.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[720px] overflow-hidden rounded-sm border border-border">
              <div className="grid grid-cols-[180px_120px_120px_140px_minmax(180px,1fr)] gap-4 border-b border-border bg-background/80 px-5 py-4">
                {['Checked at', 'Status', 'Code', 'Latency', 'Error'].map((label) => (
                  <div
                    className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
                    key={label}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="divide-y divide-border">
                {contextualChecks.length > 0 ? (
                  contextualChecks.map((check) => (
                    <div
                      className="grid grid-cols-[180px_120px_120px_140px_minmax(180px,1fr)] gap-4 px-5 py-4"
                      key={check.id}
                    >
                      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {formatIncidentDateTime(check.checkedAt)}
                      </div>
                      <div>
                        <span
                          className={cn(
                            'inline-flex rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em]',
                            check.isUp
                              ? 'bg-primary/12 text-primary'
                              : 'bg-destructive/12 text-destructive',
                          )}
                        >
                          {check.isUp ? 'UP' : 'DOWN'}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {check.statusCode ?? '--'}
                      </div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {check.latencyMs ?? '--'} ms
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {check.error ?? 'No error reported'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No contextual checks found for this incident.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof AlertTriangle
  label: string
  value: string
}) {
  return (
    <Card className="rounded-sm bg-card shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
      <CardContent className="flex items-center justify-between px-6 py-6">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex size-12 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function OverviewTile({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-sm border border-border bg-background/70 px-5 py-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  )
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-sm border border-border bg-background px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all font-medium text-foreground">{value}</dd>
    </div>
  )
}

function HistoryStep({
  description,
  label,
  tone,
}: {
  description: string
  label: string
  tone: 'success' | 'warning' | 'danger'
}) {
  return (
    <div className="flex items-start gap-3 rounded-sm border border-border bg-background px-4 py-4">
      <div
        className={cn(
          'mt-1 size-3 rounded-sm',
          tone === 'success' && 'bg-primary',
          tone === 'warning' && 'bg-amber-400',
          tone === 'danger' && 'bg-destructive',
        )}
      />
      <div className="space-y-1">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
