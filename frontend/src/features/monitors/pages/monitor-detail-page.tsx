import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from '@tanstack/react-router'
import {
  Activity,
  ArrowLeft,
  Clock3,
  ExternalLink,
  Gauge,
  LockKeyhole,
  Pencil,
  RefreshCcw,
  Save,
  SearchCheck,
  ShieldAlert,
  Siren,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ZodError } from 'zod'
import { AppShell } from '@/components/app/app-shell'
import { PageFeedback } from '@/components/app/page-feedback'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getFieldErrors, type FormErrors } from '@/features/auth/lib/form-errors'
import { DashboardHistory } from '@/features/dashboard/components/dashboard-history'
import {
  buildHistorySeries,
  buildHistoryStats,
} from '@/features/dashboard/lib/dashboard-analytics'
import {
  formatLastCheck,
  formatLatency,
  formatUptime,
} from '@/features/dashboard/lib/dashboard-formatters'
import {
  formatIncidentDateTime,
  getIncidentDuration,
  getIncidentStatusClasses,
} from '@/features/incidents/lib/incident-formatters'
import {
  createMonitorSchema,
  getMonitorTypeHelperText,
  getMonitorTypePlaceholder,
  toCreateMonitorPayload,
  type MonitorFormType,
  type MonitorFormValues,
} from '@/features/monitors/lib/create-monitor-schema'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/cn'
import { ApiError } from '@/services/http/api-client'
import {
  monitorQueryKeys,
  monitorChecksPageQueryOptions,
  monitorChecksQueryOptions,
  monitorDetailQueryOptions,
  monitorIncidentsPageQueryOptions,
  monitorIncidentsQueryOptions,
  monitorStatsQueryOptions,
  monitorService,
} from '@/services/monitors/monitor-service'
import type { AnalyticsTimeRange, Monitor } from '@/types/monitor'

export function MonitorDetailPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { user } = useAuth()
  const { id } = useParams({ from: '/monitors/$id' })
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('24H')
  const [isEditMonitorOpen, setIsEditMonitorOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [editFormValues, setEditFormValues] = useState<MonitorFormValues>({
    name: '',
    type: 'HTTPS',
    url: '',
    intervalSeconds: '300',
    timeoutMs: '10000',
    keywordExpected: '',
    keywordMatchMode: 'must-exist',
    consecutiveFailuresThreshold: '2',
  })
  const [editFieldErrors, setEditFieldErrors] =
    useState<FormErrors<keyof MonitorFormValues>>({})
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null)
  const monitorQuery = useQuery(monitorDetailQueryOptions(id))
  const statsQuery = useQuery(monitorStatsQueryOptions(id))
  const checksHistoryQuery = useQuery(monitorChecksQueryOptions(id, timeRange))
  const incidentsHistoryQuery = useQuery(monitorIncidentsQueryOptions(id, timeRange))
  const checksPageQuery = useQuery(
    monitorChecksPageQueryOptions({
      monitorId: id,
      page: 1,
      limit: 15,
    }),
  )
  const incidentsPageQuery = useQuery(
    monitorIncidentsPageQueryOptions({
      monitorId: id,
      page: 1,
      limit: 10,
    }),
  )

  const historySeries = useMemo(
    () => buildHistorySeries(checksHistoryQuery.data ?? []),
    [checksHistoryQuery.data],
  )
  const historyStats = useMemo(
    () => buildHistoryStats(checksHistoryQuery.data ?? []),
    [checksHistoryQuery.data],
  )

  const monitor = monitorQuery.data
  const stats = statsQuery.data
  const minIntervalSeconds = user?.plan === 'PRO' ? 60 : 300
  const checks = checksPageQuery.data?.items ?? []
  const incidents = incidentsPageQuery.data?.items ?? []
  const latestCheck = checks[0]
  const isEditableMonitor = monitor?.type !== 'HEARTBEAT'
  const isKeywordType = editFormValues.type === 'KEYWORD'
  const targetLabel = editFormValues.type === 'TCP' ? 'Host and port' : 'URL'
  const restartMonitorMutation = useMutation({
    mutationFn: () => monitorService.restartMonitor(id),
    onSuccess: async (result) => {
      toast.success(result.message, {
        description: 'A new check was queued for this monitor.',
      })
      await queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.all,
      })
    },
    onError: (error) => {
      toast.error(getMonitorActionErrorMessage(error))
    },
  })
  const updateMonitorMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toCreateMonitorPayload>) =>
      monitorService.updateMonitor(id, payload),
    onSuccess: async (updatedMonitor) => {
      toast.success('Monitor updated successfully.', {
        description: 'The monitor configuration was saved.',
      })
      setIsEditMonitorOpen(false)
      setEditFieldErrors({})
      setEditSubmitError(null)
      setEditFormValues(toMonitorFormValues(updatedMonitor))
      await queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.all,
      })
    },
    onError: (error) => {
      setEditSubmitError(getMonitorSubmitErrorMessage(error))
    },
  })
  const deleteMonitorMutation = useMutation({
    mutationFn: () => monitorService.deleteMonitor(id),
    onSuccess: async (result) => {
      toast.success(result.message, {
        description: 'The monitor was deleted successfully.',
      })
      setIsDeleteModalOpen(false)
      await queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.all,
      })
      await router.navigate({ to: '/dashboard' })
    },
    onError: (error) => {
      toast.error(getMonitorSubmitErrorMessage(error))
    },
  })
  const sslCertificateSummary = useMemo(
    () =>
      monitor?.type === 'SSL'
        ? getSslCertificateSummary({
            latestCheck,
            currentStatus: stats?.currentStatus ?? 'UNKNOWN',
          })
        : null,
    [latestCheck, monitor?.type, stats?.currentStatus],
  )

  if (monitorQuery.isError) {
    return (
      <AppShell activeSection="monitors">
        <PageFeedback
          action={
            <Button className="rounded-sm" onClick={() => void monitorQuery.refetch()}>
              Retry loading monitor
            </Button>
          }
          description="The selected monitor could not be loaded from the API."
          title="Unable to load monitor"
          variant="error"
        />
      </AppShell>
    )
  }

  if (monitorQuery.isLoading && !monitor) {
    return (
      <AppShell activeSection="monitors">
        <PageFeedback
          description="Loading monitor configuration, statistics and recent history."
          title="Loading monitor"
          variant="loading"
        />
      </AppShell>
    )
  }

  return (
    <AppShell
      activeSection="monitors"
      headerActions={
        <>
          <Button
            className="rounded-sm"
            onClick={() => void router.navigate({ to: '/dashboard' })}
            variant="outline"
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Button>
          <Button
            className="rounded-sm"
            onClick={() =>
              monitor?.url ? window.open(monitor.url, '_blank', 'noopener,noreferrer') : undefined
            }
            variant="outline"
          >
            <ExternalLink className="size-4" />
            Open target
          </Button>
          {isEditableMonitor ? (
            <Button
              className="rounded-sm"
              onClick={() => {
                if (!monitor) {
                  return
                }

                setEditFormValues(toMonitorFormValues(monitor))
                setEditFieldErrors({})
                setEditSubmitError(null)
                setIsEditMonitorOpen((current) => !current)
              }}
              variant="outline"
            >
              <Pencil className="size-4" />
              {isEditMonitorOpen ? 'Close editor' : 'Edit monitor'}
            </Button>
          ) : null}
          {isEditableMonitor ? (
            <Button
              className="rounded-sm"
              disabled={deleteMonitorMutation.isPending}
              onClick={() => setIsDeleteModalOpen(true)}
              variant="outline"
            >
              <Trash2 className="size-4" />
              Delete monitor
            </Button>
          ) : null}
          {monitor?.type !== 'HEARTBEAT' ? (
            <Button
              className="rounded-sm"
              disabled={
                !monitor?.isActive ||
                restartMonitorMutation.isPending ||
                deleteMonitorMutation.isPending
              }
              onClick={() => restartMonitorMutation.mutate()}
              variant="outline"
            >
              <RefreshCcw className="size-4" />
              {restartMonitorMutation.isPending ? 'Restarting...' : 'Restart monitoring'}
            </Button>
          ) : null}
        </>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-sm border border-border bg-card px-7 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/10 px-3 py-1.5">
            <Activity className="size-4 text-primary" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              Monitor Detail
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {monitor?.name ?? 'Loading monitor...'}
            </h1>
            <p className="max-w-3xl break-all text-base leading-7 text-muted-foreground">
              {monitor?.url ?? 'Heartbeat monitor without URL target.'}
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <OverviewTile label="Type" value={monitor?.type ?? '--'} />
            <OverviewTile
              label="Last check"
              value={formatLastCheck(stats?.latestCheckAt ?? monitor?.lastCheckedAt ?? null)}
            />
            <OverviewTile label="Current status" value={stats?.currentStatus ?? 'UNKNOWN'} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <CardHeader className="pb-4">
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Runtime settings for this monitor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailItem label="Interval" value={monitor ? `${monitor.intervalSeconds}s` : '--'} />
              <DetailItem label="Timeout" value={monitor ? `${monitor.timeoutMs} ms` : '--'} />
              <DetailItem label="Active" value={monitor?.isActive ? 'Yes' : 'No'} />
              <DetailItem
                label="Heartbeat token"
                value={monitor?.heartbeatToken ?? 'Not applicable'}
              />
            </CardContent>
          </Card>

          {monitor?.type === 'SSL' && sslCertificateSummary ? (
            <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
              <CardHeader className="pb-4">
                <CardTitle>SSL Certificate</CardTitle>
                <CardDescription>
                  Certificate health inferred from the latest SSL check result.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={cn(
                    'inline-flex rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em]',
                    sslCertificateSummary.tone === 'healthy' &&
                      'bg-primary/12 text-primary',
                    sslCertificateSummary.tone === 'warning' &&
                      'bg-secondary/20 text-secondary-foreground',
                    sslCertificateSummary.tone === 'danger' &&
                      'bg-destructive/12 text-destructive',
                    sslCertificateSummary.tone === 'neutral' &&
                      'bg-accent text-foreground',
                  )}
                >
                  {sslCertificateSummary.label}
                </div>
                <DetailItem label="Assessment" value={sslCertificateSummary.description} />
                <DetailItem
                  label="Latest SSL check"
                  value={latestCheck ? formatIncidentDateTime(latestCheck.checkedAt) : 'No checks yet'}
                />
                <DetailItem
                  label="Expiry policy"
                  value="Marked down if the certificate expires in less than 7 days."
                />
              </CardContent>
            </Card>
          ) : null}

          {monitor?.type === 'KEYWORD' ? (
            <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
              <CardHeader className="pb-4">
                <CardTitle>Keyword Rule</CardTitle>
                <CardDescription>
                  Text matching configuration used for this monitor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DetailItem label="Keyword" value={monitor.keywordExpected ?? 'Not configured'} />
                <DetailItem
                  label="Match mode"
                  value={monitor.keywordMustExist ? 'Keyword must exist' : 'Keyword must not exist'}
                />
                <DetailItem
                  label="Latest keyword result"
                  value={getKeywordResultLabel(latestCheck?.keywordFound)}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      {isEditableMonitor && isEditMonitorOpen ? (
        <section className="mt-6">
          <Card className="rounded-sm border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <CardTitle>Edit Monitor</CardTitle>
                <CardDescription>
                  Update the target, keyword rule and probe settings for this monitor.
                </CardDescription>
              </div>
              <div className="rounded-sm border border-primary/20 bg-primary/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                Min interval {minIntervalSeconds}s on {user?.plan ?? 'FREE'}
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={(event) => void handleMonitorUpdate(event)}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    error={editFieldErrors.name}
                    label="Monitor name"
                    required
                  >
                    <Input
                      onChange={(event) => updateEditField('name', event.target.value)}
                      placeholder="Primary API"
                      value={editFormValues.name}
                    />
                  </FormField>

                  <FormField
                    description="The existing monitor type is fixed when editing from this page."
                    error={editFieldErrors.type}
                    label="Check type"
                    required
                  >
                    <Input value={editFormValues.type} disabled readOnly />
                  </FormField>

                  <FormField
                    error={editFieldErrors.url}
                    label={targetLabel}
                    required
                  >
                    <Input
                      onChange={(event) => updateEditField('url', event.target.value)}
                      placeholder={getMonitorTypePlaceholder(editFormValues.type)}
                      value={editFormValues.url}
                    />
                  </FormField>

                  <FormField
                    description={getMonitorTypeHelperText(editFormValues.type)}
                    error={editFieldErrors.intervalSeconds}
                    label="Interval seconds"
                    required
                  >
                    <Input
                      min={minIntervalSeconds}
                      onChange={(event) =>
                        updateEditField('intervalSeconds', event.target.value)
                      }
                      type="number"
                      value={editFormValues.intervalSeconds}
                    />
                  </FormField>

                  <FormField
                    error={editFieldErrors.timeoutMs}
                    label="Timeout ms"
                    required
                  >
                    <Input
                      min={100}
                      onChange={(event) => updateEditField('timeoutMs', event.target.value)}
                      type="number"
                      value={editFormValues.timeoutMs}
                    />
                  </FormField>

                  <FormField
                    error={editFieldErrors.consecutiveFailuresThreshold}
                    label="Failure threshold"
                    required
                  >
                    <Input
                      max={10}
                      min={1}
                      onChange={(event) =>
                        updateEditField('consecutiveFailuresThreshold', event.target.value)
                      }
                      type="number"
                      value={editFormValues.consecutiveFailuresThreshold}
                    />
                  </FormField>
                </div>

                {isKeywordType ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormField
                      error={editFieldErrors.keywordExpected}
                      label="Keyword"
                      required
                    >
                      <Input
                        onChange={(event) =>
                          updateEditField('keywordExpected', event.target.value)
                        }
                        placeholder="service healthy"
                        value={editFormValues.keywordExpected}
                      />
                    </FormField>

                    <FormField
                      error={editFieldErrors.keywordMatchMode}
                      label="Match mode"
                      required
                    >
                      <select
                        className="flex h-11 w-full rounded-sm border border-input bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                        onChange={(event) =>
                          updateEditField(
                            'keywordMatchMode',
                            event.target.value as MonitorFormValues['keywordMatchMode'],
                          )
                        }
                        value={editFormValues.keywordMatchMode}
                      >
                        <option value="must-exist">Keyword must exist</option>
                        <option value="must-not-exist">Keyword must not exist</option>
                      </select>
                    </FormField>
                  </div>
                ) : null}

                {editSubmitError ? (
                  <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {editSubmitError}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button
                    className="rounded-sm"
                    disabled={updateMonitorMutation.isPending}
                    type="submit"
                  >
                    <Save className="size-4" />
                    {updateMonitorMutation.isPending ? 'Saving...' : 'Save changes'}
                  </Button>
                  <Button
                    className="rounded-sm"
                    onClick={() => {
                      if (!monitor) {
                        return
                      }

                      setEditFormValues(toMonitorFormValues(monitor))
                      setEditFieldErrors({})
                      setEditSubmitError(null)
                      setIsEditMonitorOpen(false)
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

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={monitor?.type === 'SSL' ? LockKeyhole : monitor?.type === 'KEYWORD' ? SearchCheck : Gauge}
          label="Uptime"
          tone="default"
          value={formatUptime(stats?.uptimePercentage ?? null)}
        />
        <MetricCard
          icon={Clock3}
          label="Average latency"
          tone="success"
          value={formatLatency(stats?.averageLatencyMs ?? null)}
        />
        <MetricCard
          icon={ShieldAlert}
          label="Total checks"
          tone="warning"
          value={String(stats?.totalChecks ?? 0)}
        />
        <MetricCard
          icon={Siren}
          label="Total incidents"
          tone="danger"
          value={String(stats?.totalIncidents ?? 0)}
        />
      </section>

      <DashboardHistory
        history={historySeries}
        historyStats={historyStats}
        incidents={incidentsHistoryQuery.data ?? []}
        isLoadingHistory={checksHistoryQuery.isLoading}
        isLoadingIncidents={incidentsHistoryQuery.isLoading}
        onTimeRangeChange={setTimeRange}
        selectedMonitorName={monitor?.name ?? null}
        timeRange={timeRange}
      />

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle>Recent Checks</CardTitle>
            <CardDescription>Latest probe results for this monitor.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[720px] overflow-hidden rounded-sm border border-border">
              <div className="grid grid-cols-[180px_120px_140px_140px_minmax(180px,1fr)] gap-4 border-b border-border bg-background/80 px-5 py-4">
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
                {checks.length > 0 ? (
                  checks.map((check) => (
                    <div
                      className="grid grid-cols-[180px_120px_140px_140px_minmax(180px,1fr)] gap-4 px-5 py-4"
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
                    No recent checks found for this monitor.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle>Recent Incidents</CardTitle>
            <CardDescription>Latest outages and recoveries for this monitor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {incidents.length > 0 ? (
              incidents.map((incident) => (
                <button
                  className="w-full rounded-sm border border-border bg-background px-4 py-4 text-left transition hover:border-primary/25"
                  key={incident.id}
                  onClick={() =>
                    void router.navigate({
                      to: '/incidents/$id',
                      params: { id: incident.id },
                    })
                  }
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{incident.cause}</p>
                      <p className="text-sm text-muted-foreground">
                        Started {formatIncidentDateTime(incident.startedAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Duration {getIncidentDuration(incident)}
                      </p>
                    </div>
                    <span className={getIncidentStatusClasses(incident.status)}>
                      {incident.status}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-sm border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                No incidents have been recorded for this monitor yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      {isDeleteModalOpen && monitor ? (
        <DeleteMonitorModal
          isDeleting={deleteMonitorMutation.isPending}
          monitorName={monitor.name}
          onCancel={() => {
            if (!deleteMonitorMutation.isPending) {
              setIsDeleteModalOpen(false)
            }
          }}
          onConfirm={() => deleteMonitorMutation.mutate()}
        />
      ) : null}
    </AppShell>
  )

  function updateEditField<TKey extends keyof MonitorFormValues>(
    field: TKey,
    value: MonitorFormValues[TKey],
  ) {
    setEditFormValues((current) => ({
      ...current,
      [field]: value,
    }))
    setEditFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }))
    setEditSubmitError(null)
  }

  async function handleMonitorUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEditSubmitError(null)

    try {
      createMonitorSchema(minIntervalSeconds).parse(editFormValues)
      setEditFieldErrors({})
      await updateMonitorMutation.mutateAsync(toCreateMonitorPayload(editFormValues))
    } catch (error) {
      if (error instanceof ZodError) {
        setEditFieldErrors(getFieldErrors(error))
        return
      }

      setEditSubmitError(getMonitorSubmitErrorMessage(error))
    }
  }
}

function MetricCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof Activity
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

function DeleteMonitorModal({
  isDeleting,
  monitorName,
  onCancel,
  onConfirm,
}: {
  isDeleting: boolean
  monitorName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <Card
        aria-describedby="delete-monitor-description"
        aria-labelledby="delete-monitor-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-sm border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
        role="dialog"
      >
        <CardHeader className="space-y-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-sm border border-destructive/20 bg-destructive/10 px-3 py-1.5">
            <Trash2 className="size-4 text-destructive" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-destructive">
              Delete Monitor
            </span>
          </div>
          <CardTitle id="delete-monitor-title">Delete this monitor?</CardTitle>
          <CardDescription id="delete-monitor-description">
            You are about to delete <span className="font-medium text-foreground">{monitorName}</span>.
            This action removes the monitor from your workspace and cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            <Trash2 className="size-4" />
            {isDeleting ? 'Deleting...' : 'Yes, delete monitor'}
          </Button>
          <Button
            className="rounded-sm"
            disabled={isDeleting}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function toMonitorFormValues(monitor: Monitor): MonitorFormValues {
  const type = getMonitorFormType(monitor)

  return {
    name: monitor.name,
    type,
    url: monitor.url ?? '',
    intervalSeconds: String(monitor.intervalSeconds),
    timeoutMs: String(monitor.timeoutMs),
    keywordExpected: monitor.keywordExpected ?? '',
    keywordMatchMode: monitor.keywordMustExist === false ? 'must-not-exist' : 'must-exist',
    consecutiveFailuresThreshold: String(monitor.consecutiveFailuresThreshold),
  }
}

function getMonitorFormType(monitor: Monitor): MonitorFormType {
  if (monitor.type === 'HTTP' && monitor.url?.startsWith('https://')) {
    return 'HTTPS'
  }

  switch (monitor.type) {
    case 'HTTP':
      return 'HTTP'
    case 'TCP':
      return 'TCP'
    case 'SSL':
      return 'SSL'
    case 'KEYWORD':
      return 'KEYWORD'
    case 'HEARTBEAT':
      return 'HTTP'
  }
}

function getSslCertificateSummary({
  latestCheck,
  currentStatus,
}: {
  latestCheck: {
    error: string | null
    isUp: boolean
  } | undefined
  currentStatus: 'UP' | 'DOWN' | 'UNKNOWN'
}): {
  label: string
  description: string
  tone: 'healthy' | 'warning' | 'danger' | 'neutral'
} {
  const error = latestCheck?.error ?? null

  if (!latestCheck) {
    return {
      label: 'Unknown',
      description: 'Waiting for the first SSL check before the certificate can be evaluated.',
      tone: 'neutral',
    }
  }

  if (error?.startsWith('SSL certificate expired on')) {
    return {
      label: 'Expired',
      description: error,
      tone: 'danger',
    }
  }

  if (error?.startsWith('SSL certificate expires in')) {
    return {
      label: 'Expiring Soon',
      description: error,
      tone: 'warning',
    }
  }

  if (latestCheck.isUp && currentStatus === 'UP') {
    return {
      label: 'Healthy',
      description: 'The latest SSL check did not detect an expiration issue.',
      tone: 'healthy',
    }
  }

  if (error) {
    return {
      label: 'Needs Review',
      description: error,
      tone: 'warning',
    }
  }

  return {
    label: 'Unknown',
    description: 'The certificate state could not be determined from the latest check.',
    tone: 'neutral',
  }
}

function getKeywordResultLabel(keywordFound: boolean | null | undefined): string {
  if (keywordFound === null || keywordFound === undefined) {
    return 'Not available yet'
  }

  return keywordFound ? 'Keyword found' : 'Keyword not found'
}

function getMonitorSubmitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const message = error.payload?.message

    if (Array.isArray(message)) {
      return message[0] ?? 'Unable to update the monitor right now.'
    }

    if (typeof message === 'string' && message.length > 0) {
      return message
    }

    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unable to update the monitor right now.'
}

function getMonitorActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unable to restart the monitor right now.'
}
