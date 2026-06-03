import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import {
  ArrowUpDown,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { incidentsListQueryOptions } from '@/services/incidents/incident-service'
import { monitorsQueryOptions } from '@/services/monitors/monitor-service'
import type { IncidentDetail, IncidentStatus } from '@/types/monitor'

type SortField = 'cause' | 'startedAt' | 'resolvedAt' | 'duration' | 'status'
type SortDirection = 'asc' | 'desc'

const PAGE_SIZE = 10

export function IncidentsPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<IncidentStatus | 'ALL'>('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [sortField, setSortField] = useState<SortField>('startedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const incidentsQuery = useQuery(
    incidentsListQueryOptions({
      page,
      limit: PAGE_SIZE,
      ...(status !== 'ALL' ? { status } : {}),
      ...(startDate ? { startDate: toStartOfDayIso(startDate) } : {}),
      ...(endDate ? { endDate: toEndOfDayIso(endDate) } : {}),
    }),
  )
  const monitorsQuery = useQuery(monitorsQueryOptions())
  const monitorNameMap = useMemo(
    () =>
      new Map((monitorsQuery.data?.items ?? []).map((monitor) => [monitor.id, monitor.name])),
    [monitorsQuery.data],
  )
  const filteredAndSortedItems = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()
    const items = incidentsQuery.data?.items ?? []
    const searchedItems = normalizedSearch
      ? items.filter((incident) =>
          [incident.cause, monitorNameMap.get(incident.monitorId) ?? '', incident.status]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch),
        )
      : items

    return [...searchedItems].sort((left, right) => {
      const direction = sortDirection === 'asc' ? 1 : -1

      switch (sortField) {
        case 'cause':
          return left.cause.localeCompare(right.cause) * direction
        case 'status':
          return left.status.localeCompare(right.status) * direction
        case 'resolvedAt':
          return compareNullableDates(left.resolvedAt, right.resolvedAt) * direction
        case 'duration':
          return compareDurations(left, right) * direction
        case 'startedAt':
        default:
          return left.startedAt.localeCompare(right.startedAt) * direction
      }
    })
  }, [incidentsQuery.data, monitorNameMap, searchValue, sortDirection, sortField])

  const meta = incidentsQuery.data?.meta
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortField(field)
    setSortDirection('asc')
  }

  return (
    <AppShell
      activeSection="incidents"
      onSearchChange={setSearchValue}
      searchPlaceholder="Search incidents by cause or monitor"
      searchValue={searchValue}
      headerActions={
        <Button
          className="rounded-sm"
          onClick={() => void incidentsQuery.refetch()}
          variant="outline"
        >
          <CalendarClock className="size-4" />
          Refresh
        </Button>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-sm border border-border bg-card px-7 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/10 px-3 py-1.5">
            <ShieldAlert className="size-4 text-primary" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              Incident Center
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Incident history
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">
              Review open and resolved incidents with live filters, pagination and
              per-incident drill down.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <OverviewTile
              label="Loaded incidents"
              value={String(filteredAndSortedItems.length)}
            />
            <OverviewTile
              label="Open incidents"
              value={String(filteredAndSortedItems.filter((item) => item.status === 'OPEN').length)}
            />
            <OverviewTile
              label="Resolved incidents"
              value={String(
                filteredAndSortedItems.filter((item) => item.status === 'RESOLVED').length,
              )}
            />
          </div>
        </div>

        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter incidents by status and date range.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="grid gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Status
              </span>
              <select
                className="h-11 rounded-sm border border-input bg-input px-3 text-sm text-foreground outline-none"
                onChange={(event) => {
                  setPage(1)
                  setStatus(event.target.value as IncidentStatus | 'ALL')
                }}
                value={status}
              >
                <option value="ALL">All</option>
                <option value="OPEN">OPEN</option>
                <option value="RESOLVED">RESOLVED</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Start date
              </span>
              <input
                className="h-11 rounded-sm border border-input bg-input px-3 text-sm text-foreground outline-none"
                onChange={(event) => {
                  setPage(1)
                  setStartDate(event.target.value)
                }}
                type="date"
                value={startDate}
              />
            </label>

            <label className="grid gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                End date
              </span>
              <input
                className="h-11 rounded-sm border border-input bg-input px-3 text-sm text-foreground outline-none"
                onChange={(event) => {
                  setPage(1)
                  setEndDate(event.target.value)
                }}
                type="date"
                value={endDate}
              />
            </label>

            <Button
              className="rounded-sm"
              onClick={() => {
                setPage(1)
                setStatus('ALL')
                setStartDate('')
                setEndDate('')
              }}
              variant="outline"
            >
              Reset filters
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <CardTitle>Incident Table</CardTitle>
              <CardDescription>
                Current page uses API pagination. Column sorting is applied locally.
              </CardDescription>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Page {meta?.page ?? 1} of {meta?.totalPages ?? 1}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {incidentsQuery.isError ? (
              <PageFeedback
                action={
                  <Button className="rounded-sm" onClick={() => void incidentsQuery.refetch()}>
                    Retry loading incidents
                  </Button>
                }
                description="The incidents endpoint could not be loaded with the current filters."
                title="Unable to load incidents"
                variant="error"
              />
            ) : incidentsQuery.isLoading && filteredAndSortedItems.length === 0 ? (
              <PageFeedback
                description="Loading incident history, filters and page metadata."
                title="Loading incidents"
                variant="loading"
              />
            ) : (
              <>
                <div className="min-w-[1020px] overflow-hidden rounded-sm border border-border">
                  <div className="grid grid-cols-[minmax(220px,1.4fr)_180px_180px_140px_140px_180px] gap-4 border-b border-border bg-background/80 px-5 py-4">
                    <SortableHeader
                      activeField={sortField}
                      direction={sortDirection}
                      field="cause"
                      label="Cause"
                      onSort={handleSort}
                    />
                    <SortableHeader
                      activeField={sortField}
                      direction={sortDirection}
                      field="startedAt"
                      label="Start"
                      onSort={handleSort}
                    />
                    <SortableHeader
                      activeField={sortField}
                      direction={sortDirection}
                      field="resolvedAt"
                      label="End"
                      onSort={handleSort}
                    />
                    <SortableHeader
                      activeField={sortField}
                      direction={sortDirection}
                      field="duration"
                      label="Duration"
                      onSort={handleSort}
                    />
                    <SortableHeader
                      activeField={sortField}
                      direction={sortDirection}
                      field="status"
                      label="Status"
                      onSort={handleSort}
                    />
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      Monitor
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {filteredAndSortedItems.length > 0 ? (
                      filteredAndSortedItems.map((incident) => (
                        <button
                          className="grid w-full grid-cols-[minmax(220px,1.4fr)_180px_180px_140px_140px_180px] gap-4 px-5 py-4 text-left transition hover:bg-background/60"
                          key={incident.id}
                          onClick={() =>
                            void router.navigate({
                              to: '/incidents/$id',
                              params: { id: incident.id },
                            })
                          }
                          type="button"
                        >
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{incident.cause}</p>
                            <p className="text-xs text-muted-foreground">
                              Click to open incident detail
                            </p>
                          </div>
                          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {formatIncidentDateTime(incident.startedAt)}
                          </div>
                          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {formatIncidentDateTime(incident.resolvedAt)}
                          </div>
                          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {getIncidentDuration(incident)}
                          </div>
                          <div>
                            <span className={getIncidentStatusClasses(incident.status)}>
                              {incident.status}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {monitorNameMap.get(incident.monitorId) ?? incident.monitorId}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                        No incidents found for the current filters.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <Button
                    className="rounded-sm"
                    disabled={(meta?.page ?? 1) <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    variant="outline"
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredAndSortedItems.length} results from {meta?.total ?? 0} total incidents
                  </p>
                  <Button
                    className="rounded-sm"
                    disabled={!meta || meta.page >= meta.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                    variant="outline"
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  )
}

function SortableHeader({
  activeField,
  direction,
  field,
  label,
  onSort,
}: {
  activeField: SortField
  direction: SortDirection
  field: SortField
  label: string
  onSort: (field: SortField) => void
}) {
  return (
    <button
      className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
      onClick={() => onSort(field)}
      type="button"
    >
      {label}
      <ArrowUpDown
        className={cn('size-3.5', activeField === field && 'text-primary')}
      />
      {activeField === field ? direction : null}
    </button>
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

function compareNullableDates(left: string | null, right: string | null): number {
  if (!left && !right) {
    return 0
  }

  if (!left) {
    return -1
  }

  if (!right) {
    return 1
  }

  return left.localeCompare(right)
}

function compareDurations(left: IncidentDetail, right: IncidentDetail): number {
  return getIncidentDurationValue(left) - getIncidentDurationValue(right)
}

function getIncidentDurationValue(incident: IncidentDetail): number {
  const startedAt = new Date(incident.startedAt).getTime()
  const endedAt = new Date(incident.resolvedAt ?? Date.now()).getTime()

  return endedAt - startedAt
}

function toStartOfDayIso(value: string): string {
  return new Date(`${value}T00:00:00.000`).toISOString()
}

function toEndOfDayIso(value: string): string {
  return new Date(`${value}T23:59:59.999`).toISOString()
}
