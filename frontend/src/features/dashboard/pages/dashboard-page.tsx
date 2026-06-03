import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import {
  Activity,
  Bell,
  BellRing,
  CreditCard,
  LayoutDashboard,
  MonitorCog,
  PanelTop,
  Plus,
  Radio,
  RefreshCcw,
  Save,
  ServerCrash,
  ShieldAlert,
  Signal,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ZodError } from 'zod'
import { AppShell } from '@/components/app/app-shell'
import { PageFeedback } from '@/components/app/page-feedback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getFieldErrors, type FormErrors } from '@/features/auth/lib/form-errors'
import { cn } from '@/lib/cn'
import { DashboardHistory } from '@/features/dashboard/components/dashboard-history'
import { MonitorsTable, type DashboardMonitorRow } from '@/features/dashboard/components/monitors-table'
import {
  buildFleetMetrics,
  buildHistorySeries,
  buildHistoryStats,
} from '@/features/dashboard/lib/dashboard-analytics'
import {
  formatMonitorTarget,
  toDashboardMonitorStatus,
} from '@/features/dashboard/lib/dashboard-formatters'
import {
  type DashboardActivityItem,
  useMonitorsRealtime,
} from '@/features/dashboard/hooks/use-monitors-realtime'
import {
  createMonitorSchema,
  getDefaultMonitorFormValues,
  getMonitorTypeHelperText,
  getMonitorTypePlaceholder,
  toCreateMonitorPayload,
  type MonitorFormValues,
  type MonitorFormType,
} from '@/features/monitors/lib/create-monitor-schema'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/services/http/api-client'
import {
  type CreateMonitorPayload,
  fleetIncidentsQueryOptions,
  monitorQueryKeys,
  monitorChecksQueryOptions,
  monitorIncidentsQueryOptions,
  monitorService,
  monitorsQueryOptions,
  monitorStatsQueryOptions,
} from '@/services/monitors/monitor-service'
import type { AnalyticsTimeRange } from '@/types/monitor'

export function DashboardPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { user } = useAuth()
  const [searchValue, setSearchValue] = useState('')
  const [visibleMonitorIds, setVisibleMonitorIds] = useState<string[]>([])
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('24H')
  const minIntervalSeconds = user?.plan === 'PRO' ? 60 : 300
  const [isCreateMonitorOpen, setIsCreateMonitorOpen] = useState(false)
  const [formValues, setFormValues] = useState<MonitorFormValues>(() =>
    getDefaultMonitorFormValues(minIntervalSeconds),
  )
  const [fieldErrors, setFieldErrors] = useState<FormErrors<keyof MonitorFormValues>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const monitorsQuery = useQuery(monitorsQueryOptions())
  const monitors = useMemo(() => monitorsQuery.data?.items ?? [], [monitorsQuery.data])
  const { activities, connectionState, realtimeState } = useMonitorsRealtime({
    enabled: true,
  })
  const prioritizedMonitorIds = useMemo(() => {
    const sourceIds =
      visibleMonitorIds.length > 0
        ? visibleMonitorIds
        : monitors.slice(0, 24).map((monitor) => monitor.id)

    return [...new Set(sourceIds)]
  }, [monitors, visibleMonitorIds])
  const statsQueries = useQueries({
    queries: prioritizedMonitorIds.map((monitorId) =>
      monitorStatsQueryOptions(monitorId),
    ),
  })
  const statsById = useMemo(() => {
    const entries = prioritizedMonitorIds.flatMap((monitorId, index) => {
      const stats = statsQueries[index]?.data

      return stats ? [[monitorId, stats] as const] : []
    })

    return new Map(entries)
  }, [prioritizedMonitorIds, statsQueries])
  const dashboardRows = useMemo<DashboardMonitorRow[]>(
    () =>
      monitors.map((monitor) => {
        const realtimeMonitor = realtimeState[monitor.id]
        const stats = statsById.get(monitor.id)

        return {
          id: monitor.id,
          name: realtimeMonitor?.monitorName ?? monitor.name,
          target: formatMonitorTarget(monitor),
          type: realtimeMonitor?.monitorType ?? monitor.type,
          status: toDashboardMonitorStatus(
            realtimeMonitor?.status ?? stats?.currentStatus,
          ),
          uptimePercentage: stats?.uptimePercentage ?? null,
          averageLatencyMs: stats?.averageLatencyMs ?? null,
          lastCheckedAt:
            realtimeMonitor?.lastCheckedAt ??
            stats?.latestCheckAt ??
            monitor.lastCheckedAt,
          isActive: realtimeMonitor?.isActive ?? monitor.isActive,
          cause: realtimeMonitor?.cause ?? null,
        }
      }),
    [monitors, realtimeState, statsById],
  )
  const filteredRows = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    if (!normalizedSearch) {
      return dashboardRows
    }

    return dashboardRows.filter((row) =>
      [
        row.name,
        row.target,
        row.type,
        row.status,
        row.cause ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedSearch)),
    )
  }, [dashboardRows, searchValue])
  const effectiveSelectedMonitorId = useMemo(() => {
    if (selectedMonitorId && dashboardRows.some((row) => row.id === selectedMonitorId)) {
      return selectedMonitorId
    }

    return filteredRows[0]?.id ?? dashboardRows[0]?.id ?? null
  }, [dashboardRows, filteredRows, selectedMonitorId])
  const selectedMonitor = useMemo(
    () =>
      filteredRows.find((row) => row.id === effectiveSelectedMonitorId) ??
      dashboardRows.find((row) => row.id === effectiveSelectedMonitorId) ??
      null,
    [dashboardRows, effectiveSelectedMonitorId, filteredRows],
  )
  const monitorChecksQuery = useQuery({
    ...monitorChecksQueryOptions(effectiveSelectedMonitorId ?? 'missing-monitor', timeRange),
    enabled: Boolean(effectiveSelectedMonitorId),
  })
  const monitorIncidentsQuery = useQuery({
    ...monitorIncidentsQueryOptions(effectiveSelectedMonitorId ?? 'missing-monitor', timeRange),
    enabled: Boolean(effectiveSelectedMonitorId),
  })
  const fleetIncidentsQuery = useQuery(fleetIncidentsQueryOptions(timeRange))
  const historySeries = useMemo(
    () => buildHistorySeries(monitorChecksQuery.data ?? []),
    [monitorChecksQuery.data],
  )
  const historyStats = useMemo(
    () => buildHistoryStats(monitorChecksQuery.data ?? []),
    [monitorChecksQuery.data],
  )
  const overview = useMemo(() => {
    const total = dashboardRows.length
    const up = dashboardRows.filter((row) => row.status === 'UP').length
    const down = dashboardRows.filter((row) => row.status === 'DOWN').length
    const checking = dashboardRows.filter(
      (row) => row.status === 'CHECKING',
    ).length
    const active = dashboardRows.filter((row) => row.isActive).length
    const portfolioHealth =
      total === 0 ? 0 : Number(((up / total) * 100).toFixed(2))

    return {
      total,
      up,
      down,
      checking,
      active,
      portfolioHealth,
    }
  }, [dashboardRows])
  const fleetMetrics = useMemo(
    () =>
      buildFleetMetrics({
        rows: dashboardRows,
        incidents: fleetIncidentsQuery.data ?? [],
      }),
    [dashboardRows, fleetIncidentsQuery.data],
  )
  const recentActivity = useMemo(() => {
    if (activities.length > 0) {
      return activities
    }

    return dashboardRows
      .filter((row) => row.lastCheckedAt)
      .slice(0, 8)
      .map<DashboardActivityItem>((row) => ({
        id: `${row.id}:${row.lastCheckedAt ?? 'pending'}`,
        monitorId: row.id,
        monitorName: row.name,
        monitorType: row.type,
        status: row.status === 'CHECKING' ? 'UP' : row.status,
        changedAt: row.lastCheckedAt ?? new Date().toISOString(),
        cause: row.cause,
      }))
  }, [activities, dashboardRows])
  const createMonitorMutation = useMutation({
    mutationFn: (payload: CreateMonitorPayload) => monitorService.createMonitor(payload),
    onSuccess: async (monitor) => {
      toast.success('Monitor created successfully.')
      resetMonitorForm()
      setIsCreateMonitorOpen(false)
      setSelectedMonitorId(monitor.id)
      await queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.all,
      })
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error))
    },
  })

  const handleVisibleIdsChange = useCallback((monitorIds: string[]) => {
    setVisibleMonitorIds((current) =>
      areSameIds(current, monitorIds) ? current : monitorIds,
    )
  }, [])

  const updateField = <TKey extends keyof MonitorFormValues>(
    field: TKey,
    value: MonitorFormValues[TKey],
  ) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }))
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }))
    setSubmitError(null)
  }

  const handleMonitorSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    try {
      createMonitorSchema(minIntervalSeconds).parse(formValues)
      setFieldErrors({})
      await createMonitorMutation.mutateAsync(toCreateMonitorPayload(formValues))
    } catch (error) {
      if (error instanceof ZodError) {
        setFieldErrors(getFieldErrors(error))
        return
      }

      setSubmitError(getErrorMessage(error))
    }
  }

  function resetMonitorForm() {
    setFormValues(getDefaultMonitorFormValues(minIntervalSeconds))
    setFieldErrors({})
    setSubmitError(null)
  }

  const isKeywordType = formValues.type === 'KEYWORD'
  const targetLabel = formValues.type === 'TCP' ? 'Host and port' : 'URL'

  return (
    <AppShell
      activeSection="dashboard"
      onSearchChange={setSearchValue}
      searchPlaceholder="Search monitors, targets or status"
      searchValue={searchValue}
      headerActions={
        <>
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em]',
              connectionState === 'connected'
                ? 'bg-primary/12 text-primary'
                : 'bg-destructive/12 text-destructive',
            )}
          >
            <Radio className="size-3.5" />
            {connectionState === 'connected' ? 'SSE Connected' : 'SSE Reconnecting'}
          </div>
          <Button
            className="rounded-sm"
            onClick={() => void monitorsQuery.refetch()}
            variant="outline"
          >
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
          <Button
            className="rounded-sm bg-primary px-5 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground shadow-[0_0_24px_rgba(78,222,163,0.2)]"
            onClick={() => {
              setIsCreateMonitorOpen((current) => {
                const nextValue = !current

                if (nextValue) {
                  resetMonitorForm()
                }

                return nextValue
              })
            }}
          >
            <Plus className="size-4" />
            {isCreateMonitorOpen ? 'Close Form' : 'Add Monitor'}
          </Button>
          <Button
            className="rounded-sm"
            onClick={() => void router.navigate({ to: '/billing' })}
            variant="outline"
          >
            <CreditCard className="size-4" />
            Billing
          </Button>
          <Button
            className="rounded-sm"
            onClick={() => void router.navigate({ to: '/status-pages' })}
            variant="outline"
          >
            <PanelTop className="size-4" />
            Status Pages
          </Button>
          <Button
            className="rounded-sm"
            onClick={() => void router.navigate({ to: '/alerts' })}
            variant="outline"
          >
            <Bell className="size-4" />
            Alert Contacts
          </Button>
          <Button
            className="rounded-sm"
            onClick={() => void router.navigate({ to: '/incidents' })}
            variant="outline"
          >
            <ShieldAlert className="size-4" />
            Incident Center
          </Button>
        </>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-sm border border-border bg-card px-7 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/10 px-3 py-1.5">
            <Zap className="size-4 text-primary" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              Realtime portfolio
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              System overview for your monitoring fleet.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Monitor every endpoint from one control surface with live status updates,
              virtualized rendering and cookie-backed authentication.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <OverviewTile
              icon={Activity}
              label="Portfolio health"
              value={`${overview.portfolioHealth.toFixed(2)}%`}
            />
            <OverviewTile
              icon={BellRing}
              label="Active monitors"
              value={String(overview.active)}
            />
            <OverviewTile
              icon={MonitorCog}
              label="Loaded rows"
              value={String(filteredRows.length)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <CardHeader className="pb-4">
              <CardTitle>Session</CardTitle>
              <CardDescription>
                Secure access through httpOnly cookies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SessionDetail label="Realtime" value={connectionState} />
              <SessionDetail label="Selected monitor" value={selectedMonitor?.name ?? 'None'} />
              <SessionDetail
                label="Historical range"
                value={timeRange}
              />
            </CardContent>
          </Card>

          <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <CardHeader className="pb-4">
              <CardTitle>Realtime Stream</CardTitle>
              <CardDescription>
                Snapshot + live status events from `/sse/monitors`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SessionDetail label="Connection" value={connectionState} />
              <SessionDetail
                label="Last events"
                value={String(activities.length)}
              />
              <SessionDetail
                label="Query state"
                value={monitorsQuery.isFetching ? 'Refreshing' : 'Stable'}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={LayoutDashboard}
          label="Global uptime"
          tone="default"
          value={`${fleetMetrics.globalUptime.toFixed(2)}%`}
        />
        <MetricCard
          icon={Signal}
          label="Active monitors"
          tone="success"
          value={String(fleetMetrics.activeMonitors)}
        />
        <MetricCard
          icon={ServerCrash}
          label="Down monitors"
          tone="danger"
          value={String(fleetMetrics.downMonitors)}
        />
        <MetricCard
          icon={ShieldAlert}
          label="Total incidents"
          tone="warning"
          value={String(fleetMetrics.totalIncidents)}
        />
      </section>

      {isCreateMonitorOpen ? (
        <section className="mt-8">
          <Card className="rounded-sm border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <CardTitle>Create Monitor</CardTitle>
                <CardDescription>
                  Add a new URL or target using HTTP, HTTPS, TCP, SSL or KEYWORD checks.
                </CardDescription>
              </div>
              <div className="rounded-sm border border-primary/20 bg-primary/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                Min interval {minIntervalSeconds}s on {user?.plan ?? 'FREE'}
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={(event) => void handleMonitorSubmit(event)}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    error={fieldErrors.name}
                    label="Monitor name"
                    required
                  >
                    <Input
                      onChange={(event) => updateField('name', event.target.value)}
                      placeholder="Primary API"
                      value={formValues.name}
                    />
                  </FormField>

                  <FormField
                    description={getMonitorTypeHelperText(formValues.type)}
                    error={fieldErrors.type}
                    label="Check type"
                    required
                  >
                    <select
                      className="flex h-11 w-full rounded-sm border border-input bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                      onChange={(event) =>
                        updateField('type', event.target.value as MonitorFormType)
                      }
                      value={formValues.type}
                    >
                      <option value="HTTP">HTTP</option>
                      <option value="HTTPS">HTTPS</option>
                      <option value="TCP">TCP</option>
                      <option value="SSL">SSL</option>
                      <option value="KEYWORD">KEYWORD</option>
                    </select>
                  </FormField>

                  <FormField
                    error={fieldErrors.url}
                    label={targetLabel}
                    required
                  >
                    <Input
                      onChange={(event) => updateField('url', event.target.value)}
                      placeholder={getMonitorTypePlaceholder(formValues.type)}
                      value={formValues.url}
                    />
                  </FormField>

                  <FormField
                    description="The backend enforces this minimum by plan."
                    error={fieldErrors.intervalSeconds}
                    label="Interval seconds"
                    required
                  >
                    <Input
                      min={minIntervalSeconds}
                      onChange={(event) => updateField('intervalSeconds', event.target.value)}
                      type="number"
                      value={formValues.intervalSeconds}
                    />
                  </FormField>

                  <FormField
                    error={fieldErrors.timeoutMs}
                    label="Timeout ms"
                    required
                  >
                    <Input
                      min={100}
                      onChange={(event) => updateField('timeoutMs', event.target.value)}
                      type="number"
                      value={formValues.timeoutMs}
                    />
                  </FormField>

                  <FormField
                    error={fieldErrors.consecutiveFailuresThreshold}
                    label="Failure threshold"
                    required
                  >
                    <Input
                      max={10}
                      min={1}
                      onChange={(event) =>
                        updateField('consecutiveFailuresThreshold', event.target.value)
                      }
                      type="number"
                      value={formValues.consecutiveFailuresThreshold}
                    />
                  </FormField>
                </div>

                {isKeywordType ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormField
                      error={fieldErrors.keywordExpected}
                      label="Keyword"
                      required
                    >
                      <Input
                        onChange={(event) =>
                          updateField('keywordExpected', event.target.value)
                        }
                        placeholder="service healthy"
                        value={formValues.keywordExpected}
                      />
                    </FormField>

                    <FormField
                      error={fieldErrors.keywordMatchMode}
                      label="Match mode"
                      required
                    >
                      <select
                        className="flex h-11 w-full rounded-sm border border-input bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                        onChange={(event) =>
                          updateField(
                            'keywordMatchMode',
                            event.target.value as MonitorFormValues['keywordMatchMode'],
                          )
                        }
                        value={formValues.keywordMatchMode}
                      >
                        <option value="must-exist">Keyword must exist</option>
                        <option value="must-not-exist">Keyword must not exist</option>
                      </select>
                    </FormField>
                  </div>
                ) : null}

                {submitError ? (
                  <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {submitError}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button
                    className="rounded-sm"
                    disabled={createMonitorMutation.isPending}
                    type="submit"
                  >
                    <Save className="size-4" />
                    {createMonitorMutation.isPending ? 'Creating...' : 'Create monitor'}
                  </Button>
                  <Button
                    className="rounded-sm"
                    onClick={() => {
                      resetMonitorForm()
                      setIsCreateMonitorOpen(false)
                    }}
                    type="button"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="mt-8 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">
              Monitor Fleet
            </p>
            <h3 className="text-3xl font-semibold tracking-tight text-foreground">
              Virtualized Monitor Table
            </h3>
            <p className="text-sm text-muted-foreground">
              Optimized for large datasets with realtime status overlays.
            </p>
          </div>

          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {filteredRows.length} of {dashboardRows.length} monitors visible
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            className="rounded-sm"
            disabled={!effectiveSelectedMonitorId}
            onClick={() =>
              effectiveSelectedMonitorId
                ? void router.navigate({
                    to: '/monitors/$id',
                    params: { id: effectiveSelectedMonitorId },
                  })
                : undefined
            }
          >
            <MonitorCog className="size-4" />
            Open selected monitor
          </Button>
          <Button
            className="rounded-sm"
            onClick={() => void router.navigate({ to: '/billing' })}
            variant="outline"
          >
            <CreditCard className="size-4" />
            Open billing
          </Button>
          <Button
            className="rounded-sm"
            onClick={() => void router.navigate({ to: '/status-pages' })}
            variant="outline"
          >
            <PanelTop className="size-4" />
            Manage status pages
          </Button>
          <Button
            className="rounded-sm"
            onClick={() => void router.navigate({ to: '/alerts' })}
            variant="outline"
          >
            <Bell className="size-4" />
            View alerts
          </Button>
          <Button
            className="rounded-sm"
            onClick={() => void router.navigate({ to: '/incidents' })}
            variant="outline"
          >
            <ShieldAlert className="size-4" />
            View all incidents
          </Button>
        </div>

        {monitorsQuery.isError ? (
          <PageFeedback
            action={
              <Button className="rounded-sm" onClick={() => void monitorsQuery.refetch()}>
                Retry loading monitors
              </Button>
            }
            description="The dashboard could not load your monitor fleet from the API."
            title="Unable to load monitors"
            variant="error"
          />
        ) : (
          <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            {monitorsQuery.isLoading && dashboardRows.length === 0 ? (
              <PageFeedback
                description="Loading your monitor fleet and current realtime overlays."
                title="Loading dashboard"
                variant="loading"
              />
            ) : filteredRows.length > 0 ? (
              <MonitorsTable
                isFetchingMore={monitorsQuery.isFetching}
                isLoading={monitorsQuery.isLoading}
                onSelectMonitor={setSelectedMonitorId}
                onVisibleIdsChange={handleVisibleIdsChange}
                rows={filteredRows}
                selectedMonitorId={effectiveSelectedMonitorId}
              />
            ) : (
              <PageFeedback
                description="Try another search or create your first monitor to populate the dashboard."
                title="No monitors match the current view"
                variant="empty"
              />
            )}
          </section>
        )}

        {effectiveSelectedMonitorId ? (
          <DashboardHistory
            history={historySeries}
            historyStats={historyStats}
            incidents={monitorIncidentsQuery.data ?? []}
            isLoadingHistory={monitorChecksQuery.isLoading}
            isLoadingIncidents={monitorIncidentsQuery.isLoading}
            onTimeRangeChange={setTimeRange}
            selectedMonitorName={selectedMonitor?.name ?? null}
            timeRange={timeRange}
          />
        ) : (
          <section className="mt-8">
            <PageFeedback
              description="Select a monitor from the fleet table to explore historical uptime, latency and incidents."
              title="No monitor selected"
              variant="empty"
            />
          </section>
        )}
      </section>

        <section className="mt-8">
          <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <CardTitle>Live Monitoring Logs</CardTitle>
                <CardDescription>
                  Recent state changes coming from the realtime SSE stream.
                </CardDescription>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {connectionState === 'connected' ? 'Receiving live updates' : 'Waiting for stream'}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[760px] overflow-hidden rounded-sm border border-border">
                <div className="grid grid-cols-[180px_minmax(220px,1.6fr)_120px_160px] gap-4 border-b border-border bg-background/80 px-5 py-4">
                  {['Timestamp', 'Monitor', 'Type', 'Status'].map((label) => (
                    <div
                      className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
                      key={label}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="divide-y divide-border">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity) => (
                      <div
                        className="grid grid-cols-[180px_minmax(220px,1.6fr)_120px_160px] gap-4 px-5 py-4"
                        key={activity.id}
                      >
                        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {new Date(activity.changedAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            {activity.monitorName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.cause ?? 'No incident details reported.'}
                          </p>
                        </div>
                        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {activity.monitorType}
                        </div>
                        <div>
                          <ActivityStatus status={activity.status} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                      Waiting for monitor events to appear in the live log.
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
  tone,
  value,
}: {
  icon: LucideIcon
  label: string
  tone: 'default' | 'success' | 'danger' | 'warning'
  value: string
}) {
  return (
    <Card className="rounded-sm bg-card shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
      <CardContent className="flex items-center justify-between px-6 py-6">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div
          className={cn(
            'flex size-12 items-center justify-center rounded-sm',
            tone === 'default' && 'bg-accent text-foreground',
            tone === 'success' && 'bg-primary/12 text-primary',
            tone === 'danger' && 'bg-destructive/12 text-destructive',
            tone === 'warning' && 'bg-secondary/20 text-secondary-foreground',
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function OverviewTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="rounded-sm border border-border bg-background/70 px-5 py-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  )
}

function SessionDetail({
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

function ActivityStatus({
  status,
}: {
  status: 'UP' | 'DOWN'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em]',
        status === 'UP' ? 'bg-primary/12 text-primary' : 'bg-destructive/12 text-destructive',
      )}
    >
      <span
        className={cn(
          'size-2 rounded-sm',
          status === 'UP' && 'bg-primary shadow-[0_0_12px_var(--color-primary)]',
          status === 'DOWN' &&
            'bg-destructive shadow-[0_0_12px_var(--color-destructive)]',
        )}
      />
      {status}
    </span>
  )
}

function FormField({
  children,
  description,
  error,
  label,
  required = false,
}: {
  children: React.ReactNode
  description?: string | undefined
  error?: string | undefined
  label: string
  required?: boolean
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </label>
  )
}

function areSameIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const message = error.payload?.message

    if (Array.isArray(message)) {
      return message[0] ?? 'Unable to create the monitor.'
    }

    if (typeof message === 'string' && message.length > 0) {
      return message
    }

    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to create the monitor.'
}
