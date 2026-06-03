import {
  Activity,
  AlertTriangle,
  Gauge,
  LineChart,
  TimerReset,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import {
  buildTimeRangeLabel,
  getIncidentDurationLabel,
  type HistoryPoint,
  type HistoryStats,
} from '@/features/dashboard/lib/dashboard-analytics'
import type { AnalyticsTimeRange, IncidentDetail } from '@/types/monitor'

type DashboardHistoryProps = {
  selectedMonitorName: string | null
  timeRange: AnalyticsTimeRange
  onTimeRangeChange: (range: AnalyticsTimeRange) => void
  history: HistoryPoint[]
  historyStats: HistoryStats
  incidents: IncidentDetail[]
  isLoadingHistory: boolean
  isLoadingIncidents: boolean
}

const timeRangeOptions: AnalyticsTimeRange[] = ['24H', '7D', '30D', '90D']

export function DashboardHistory({
  selectedMonitorName,
  timeRange,
  onTimeRangeChange,
  history,
  historyStats,
  incidents,
  isLoadingHistory,
  isLoadingIncidents,
}: DashboardHistoryProps) {
  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">
            Historical Analytics
          </p>
          <h3 className="text-3xl font-semibold tracking-tight text-foreground">
            {selectedMonitorName ? `${selectedMonitorName} performance history` : 'Select a monitor'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {buildTimeRangeLabel(timeRange)} of uptime, latency and incident activity.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {timeRangeOptions.map((option) => (
            <Button
              className={cn(
                'rounded-sm font-mono text-xs uppercase tracking-[0.18em]',
                option === timeRange && 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
              key={option}
              onClick={() => onTimeRangeChange(option)}
              variant={option === timeRange ? 'default' : 'outline'}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HistoryStatCard icon={Activity} label="Average" value={formatMs(historyStats.averageLatencyMs)} />
        <HistoryStatCard icon={Gauge} label="Minimum" value={formatMs(historyStats.minimumLatencyMs)} />
        <HistoryStatCard icon={LineChart} label="Maximum" value={formatMs(historyStats.maximumLatencyMs)} />
        <HistoryStatCard
          icon={TimerReset}
          label="Uptime"
          value={`${historyStats.uptimePercentage.toFixed(2)}%`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1.3fr_0.95fr]">
        <ChartCard
          description="Availability trend over the selected time range."
          isLoading={isLoadingHistory}
          title="Uptime Graph"
        >
          <ResponsiveContainer height={320} width="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="uptimeArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                minTickGap={32}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                domain={[0, 100]}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                tickFormatter={(value) => `${value}%`}
                tickLine={false}
                width={46}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [`${String(value ?? '--')}%`, 'Uptime']}
                labelStyle={{ color: 'var(--color-foreground)' }}
              />
              <Area
                dataKey="uptime"
                fill="url(#uptimeArea)"
                stroke="var(--color-primary)"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          description="Response time distribution from historical checks."
          isLoading={isLoadingHistory}
          title="Latency Graph"
        >
          <ResponsiveContainer height={320} width="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="latencyArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#7dd3fc" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7dd3fc" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                minTickGap={32}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                tickFormatter={(value) => `${value} ms`}
                tickLine={false}
                width={56}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [
                  value === null || value === undefined ? '--' : `${String(value)} ms`,
                  'Latency',
                ]}
                labelStyle={{ color: 'var(--color-foreground)' }}
              />
              <Line
                connectNulls={false}
                dataKey="latency"
                dot={false}
                stroke="#7dd3fc"
                strokeWidth={2}
                type="monotone"
              />
              <Area dataKey="latency" fill="url(#latencyArea)" stroke="transparent" type="monotone" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle>Incident Timeline</CardTitle>
            <CardDescription>
              {incidents.length} incidents detected in the selected range.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoadingIncidents ? (
                Array.from({ length: 4 }, (_, index) => (
                  <div
                    className="h-20 animate-pulse rounded-sm bg-background"
                    key={`incident-skeleton-${index}`}
                  />
                ))
              ) : incidents.length > 0 ? (
                incidents.map((incident) => (
                  <article
                    className="rounded-sm border border-border bg-background px-4 py-4"
                    key={incident.id}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-1 flex size-9 items-center justify-center rounded-sm',
                          incident.status === 'OPEN'
                            ? 'bg-destructive/12 text-destructive'
                            : 'bg-primary/12 text-primary',
                        )}
                      >
                        <AlertTriangle className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{incident.cause}</p>
                          <span
                            className={cn(
                              'rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em]',
                              incident.status === 'OPEN'
                                ? 'bg-destructive/12 text-destructive'
                                : 'bg-primary/12 text-primary',
                            )}
                          >
                            {incident.status}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Started {formatDateTime(incident.startedAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Duration {getIncidentDurationLabel(incident)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-sm border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                  No incidents found for this time range.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function ChartCard({
  children,
  description,
  isLoading,
  title,
}: {
  children: React.ReactNode
  description: string
  isLoading: boolean
  title: string
}) {
  return (
    <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[320px] animate-pulse rounded-sm bg-background" />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

function HistoryStatCard({
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

function formatMs(value: number | null): string {
  if (value === null) {
    return '--'
  }

  return `${value} ms`
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const tooltipStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: '16px',
  backgroundColor: 'var(--color-card)',
  color: 'var(--color-foreground)',
  boxShadow: '0 12px 32px rgba(0,0,0,0.24)',
}
