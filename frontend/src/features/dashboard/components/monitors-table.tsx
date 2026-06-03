import { useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Activity,
  Binary,
  Clock3,
  FileSearch,
  HeartPulse,
  LockKeyhole,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import {
  formatLastCheck,
  formatLatency,
  formatUptime,
} from '@/features/dashboard/lib/dashboard-formatters'
import type { DashboardMonitorStatus, MonitorType } from '@/types/monitor'

export type DashboardMonitorRow = {
  id: string
  name: string
  target: string
  type: MonitorType
  status: DashboardMonitorStatus
  uptimePercentage: number | null
  averageLatencyMs: number | null
  lastCheckedAt: string | null
  isActive: boolean
  cause: string | null
}

type MonitorsTableProps = {
  rows: DashboardMonitorRow[]
  isLoading: boolean
  isFetchingMore: boolean
  onVisibleIdsChange: (monitorIds: string[]) => void
  onSelectMonitor: (monitorId: string) => void
  selectedMonitorId: string | null
}

const headerColumns = [
  'Monitor',
  'Status',
  'Type',
  'Uptime',
  'Latency',
  'Last check',
] as const

const monitorTypeIcons: Record<MonitorType, LucideIcon> = {
  HTTP: Activity,
  TCP: Binary,
  SSL: LockKeyhole,
  KEYWORD: FileSearch,
  HEARTBEAT: HeartPulse,
}

export function MonitorsTable({
  rows,
  isLoading,
  isFetchingMore,
  onVisibleIdsChange,
  onSelectMonitor,
  selectedMonitorId,
}: MonitorsTableProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 92,
    overscan: 10,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const visibleIds = useMemo(
    () =>
      virtualRows
        .map((item) => rows[item.index]?.id)
        .filter((id): id is string => Boolean(id)),
    [rows, virtualRows],
  )

  useEffect(() => {
    onVisibleIdsChange(visibleIds)
  }, [onVisibleIdsChange, visibleIds])

  if (isLoading) {
    return (
      <div className="rounded-sm border border-border bg-card">
        <div className="grid min-w-[980px] grid-cols-[minmax(320px,2.2fr)_140px_140px_140px_140px_180px] gap-4 border-b border-border px-6 py-4">
          {headerColumns.map((header) => (
            <div
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
              key={header}
            >
              {header}
            </div>
          ))}
        </div>
        <div className="space-y-3 px-4 py-4">
          {Array.from({ length: 7 }, (_, index) => (
            <div
              className="h-[76px] animate-pulse rounded-sm bg-background"
              key={`monitor-skeleton-${index}`}
            />
          ))}
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-border bg-card px-8 py-14 text-center">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-sm border border-border bg-background text-primary">
            <Activity className="size-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">
              No monitors loaded yet
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Create your first monitor to start tracking uptime, latency and
              incidents in real time.
            </p>
          </div>
          <Button className="rounded-sm font-mono text-xs uppercase tracking-[0.22em]">
            Add Monitor
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-sm border border-border bg-card shadow-[0_16px_48px_rgba(0,0,0,0.18)]">
      <div className="overflow-x-auto">
        <div className="grid min-w-[980px] grid-cols-[minmax(320px,2.2fr)_140px_140px_140px_140px_180px] gap-4 border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
          {headerColumns.map((header) => (
            <div
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
              key={header}
            >
              {header}
            </div>
          ))}
        </div>

        <div className="min-w-[980px] px-3 py-3">
          <div className="h-[620px] overflow-auto" ref={scrollRef}>
            <div
              className="relative"
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
              }}
            >
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index]

                if (!row) {
                  return null
                }

                const TypeIcon = monitorTypeIcons[row.type]

                return (
                  <div
                    className="absolute left-0 top-0 w-full px-3"
                    key={row.id}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <article
                      aria-pressed={selectedMonitorId === row.id}
                      className={cn(
                        'grid h-[76px] cursor-pointer grid-cols-[minmax(320px,2.2fr)_140px_140px_140px_140px_180px] items-center gap-4 rounded-sm border px-3 transition-colors',
                        row.status === 'DOWN'
                          ? 'border-destructive/30 bg-destructive/5'
                          : 'border-transparent bg-background hover:border-primary/20',
                        selectedMonitorId === row.id &&
                          'border-primary/40 bg-primary/5 shadow-[0_0_0_1px_rgba(78,222,163,0.2)]',
                      )}
                      onClick={() => onSelectMonitor(row.id)}
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div
                          className={cn(
                            'flex size-11 shrink-0 items-center justify-center rounded-sm border',
                            row.status === 'DOWN'
                              ? 'border-destructive/25 bg-destructive/10 text-destructive'
                              : 'border-primary/15 bg-primary/10 text-primary',
                          )}
                        >
                          <TypeIcon className="size-5" />
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-foreground">
                              {row.name}
                            </p>
                            {!row.isActive ? (
                              <span className="rounded-sm border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                Paused
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            {row.target}
                          </p>
                          {row.cause ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {row.cause}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div>
                        <StatusBadge status={row.status} />
                      </div>

                      <div>
                        <span className="rounded-sm border border-border bg-background px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {row.type}
                        </span>
                      </div>

                      <MetricValue
                        accent={row.status === 'DOWN' ? 'destructive' : 'default'}
                        value={formatUptime(row.uptimePercentage)}
                      />
                      <MetricValue
                        accent={row.status === 'DOWN' ? 'destructive' : 'default'}
                        value={formatLatency(row.averageLatencyMs)}
                      />
                      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        <Clock3 className="size-4" />
                        <span>{formatLastCheck(row.lastCheckedAt)}</span>
                      </div>
                    </article>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {isFetchingMore ? (
        <div className="border-t border-border px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Loading more monitors...
        </div>
      ) : null}
    </div>
  )
}

function MetricValue({
  accent,
  value,
}: {
  accent: 'default' | 'destructive'
  value: string
}) {
  return (
    <p
      className={cn(
        'font-mono text-sm uppercase tracking-[0.14em]',
        accent === 'destructive' ? 'text-destructive' : 'text-foreground',
      )}
    >
      {value}
    </p>
  )
}

function StatusBadge({ status }: { status: DashboardMonitorStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em]',
        status === 'UP' && 'bg-primary/12 text-primary',
        status === 'DOWN' && 'bg-destructive/12 text-destructive',
        status === 'CHECKING' && 'bg-secondary/12 text-secondary-foreground',
      )}
    >
      <span
        className={cn(
          'size-2 rounded-sm',
          status === 'UP' && 'bg-primary shadow-[0_0_12px_var(--color-primary)]',
          status === 'DOWN' &&
            'bg-destructive shadow-[0_0_12px_var(--color-destructive)]',
          status === 'CHECKING' && 'animate-pulse bg-secondary',
        )}
      />
      {status}
    </span>
  )
}
