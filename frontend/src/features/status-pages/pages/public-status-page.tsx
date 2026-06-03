import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  Clock3,
  Globe,
  Server,
  ShieldCheck,
} from 'lucide-react'
import { PageFeedback } from '@/components/app/page-feedback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { publicStatusPageQueryOptions } from '@/services/status-pages/status-page-service'
import type {
  PublicStatusPage,
  StatusPageMonitorSummary,
  StatusPageOverallStatus,
} from '@/types/status-page'

export function PublicStatusPage() {
  const { slug } = useParams({ from: '/status/$slug' })
  const statusPageQuery = useQuery(publicStatusPageQueryOptions(slug))
  const statusPage = statusPageQuery.data
  const monitors = statusPage?.monitors ?? []
  const openIncidents = monitors.filter((monitor) => monitor.status === 'DOWN')
  const availability = monitors.length > 0
    ? ((monitors.filter((monitor) => monitor.status === 'UP').length / monitors.length) * 100).toFixed(2)
    : '0.00'

  if (statusPageQuery.isError) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageFeedback
            action={null}
            description="The requested public status page is unavailable or could not be loaded."
            title="Unable to load public status page"
            variant="error"
          />
        </div>
      </div>
    )
  }

  if (statusPageQuery.isLoading && !statusPage) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageFeedback
            description="Loading public monitor status, availability and active incidents."
            title="Loading public status page"
            variant="loading"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-sm border border-border bg-card px-7 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/10 px-3 py-1.5">
            <Globe className="size-4 text-primary" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              Public Status Page
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {statusPage?.name ?? 'Loading status page...'}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">
              {statusPage?.description ?? 'Live status summary for the selected services.'}
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <OverviewTile label="Overall status" value={statusPage?.overallStatus ?? 'UNKNOWN'} />
            <OverviewTile label="Current uptime" value={`${availability}%`} />
            <OverviewTile
              label="Last update"
              value={statusPage ? formatPublicDate(statusPage.updatedAt) : '--'}
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={ShieldCheck} label="Operational" value={String(monitors.filter((item) => item.status === 'UP').length)} />
          <MetricCard icon={AlertTriangle} label="Incidents" value={String(openIncidents.length)} />
          <MetricCard icon={Server} label="Monitors" value={String(monitors.length)} />
          <MetricCard icon={Activity} label="Recent checks" value={String(monitors.filter((item) => item.lastCheckedAt).length)} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <CardHeader>
              <CardTitle>Current Status</CardTitle>
              <CardDescription>
                Realtime monitor states included in this public page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {monitors.length > 0 ? (
                monitors.map((monitor) => (
                  <MonitorStatusRow key={monitor.monitorId} monitor={monitor} />
                ))
              ) : (
                <div className="rounded-sm border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                  No monitors were added to this public status page.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <CardHeader>
              <CardTitle>Recent Incidents</CardTitle>
              <CardDescription>
                Current open incidents exposed by the public payload.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {openIncidents.length > 0 ? (
                openIncidents.map((monitor) => (
                  <article
                    className="rounded-sm border border-destructive/20 bg-destructive/5 px-4 py-4"
                    key={`${monitor.monitorId}:${monitor.incidentId ?? 'open'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex size-9 items-center justify-center rounded-sm bg-destructive/12 text-destructive">
                        <AlertTriangle className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{monitor.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {monitor.cause ?? 'Service issue detected.'}
                        </p>
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          {monitor.type}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-sm border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                  No active incidents are currently reported.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <CardHeader>
              <CardTitle>Recent History</CardTitle>
              <CardDescription>
                Last known checks available from the public response.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[900px] overflow-hidden rounded-sm border border-border">
                <div className="grid grid-cols-[minmax(220px,1.3fr)_140px_160px_220px] gap-4 border-b border-border bg-background/80 px-5 py-4">
                  {['Monitor', 'Status', 'Last check', 'Cause'].map((label) => (
                    <div
                      className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
                      key={label}
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-border">
                  {monitors.length > 0 ? (
                    monitors.map((monitor) => (
                      <div
                        className="grid grid-cols-[minmax(220px,1.3fr)_140px_160px_220px] gap-4 px-5 py-4"
                        key={`history:${monitor.monitorId}`}
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{monitor.name}</p>
                          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            {monitor.type}
                          </p>
                        </div>
                        <div>
                          <StatusPill status={monitor.status} />
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          <Clock3 className="size-4" />
                          {monitor.lastCheckedAt ? formatPublicDate(monitor.lastCheckedAt) : '--'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {monitor.cause ?? 'No issue reported'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                      No history is available for this status page.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
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

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity
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

function MonitorStatusRow({ monitor }: { monitor: StatusPageMonitorSummary }) {
  return (
    <article className="rounded-sm border border-border bg-background px-4 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{monitor.name}</p>
            <StatusPill status={monitor.status} />
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {monitor.type}
          </p>
          <p className="text-sm text-muted-foreground">
            {monitor.cause ?? 'No incidents reported.'}
          </p>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Last check {monitor.lastCheckedAt ? formatPublicDate(monitor.lastCheckedAt) : '--'}
        </p>
      </div>
    </article>
  )
}

function StatusPill({ status }: { status: StatusPageMonitorSummary['status'] | StatusPageOverallStatus }) {
  const styles: Record<string, string> = {
    OPERATIONAL: 'bg-primary/10 text-primary',
    DEGRADED: 'bg-amber-400/15 text-amber-500',
    OUTAGE: 'bg-destructive/10 text-destructive',
    UNKNOWN: 'bg-secondary/20 text-secondary-foreground',
    UP: 'bg-primary/10 text-primary',
    DOWN: 'bg-destructive/10 text-destructive',
  }

  return (
    <span className={`inline-flex rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] ${styles[status] ?? styles.UNKNOWN}`}>
      {status}
    </span>
  )
}

function formatPublicDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
