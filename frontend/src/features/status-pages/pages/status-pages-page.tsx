import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  Globe,
  Link2,
  Lock,
  PanelTop,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ZodError } from 'zod'
import { AppShell } from '@/components/app/app-shell'
import { PageFeedback } from '@/components/app/page-feedback'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { env } from '@/app/env'
import { getFieldErrors, type FormErrors } from '@/features/auth/lib/form-errors'
import {
  statusPageSchema,
  type StatusPageFormValues,
} from '@/features/status-pages/lib/status-page-schemas'
import { ApiError } from '@/services/http/api-client'
import {
  statusPageQueryKeys,
  statusPagesQueryOptions,
  statusPageService,
} from '@/services/status-pages/status-page-service'
import { monitorsQueryOptions } from '@/services/monitors/monitor-service'
import type { Monitor } from '@/types/monitor'
import type { StatusPage } from '@/types/status-page'

const PAGE_SIZE = 10

const defaultFormValues: StatusPageFormValues = {
  name: '',
  slug: '',
  description: '',
  isPublic: true,
  monitorIds: [],
}

export function StatusPagesPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const [editingStatusPageId, setEditingStatusPageId] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<StatusPageFormValues>(defaultFormValues)
  const [fieldErrors, setFieldErrors] = useState<FormErrors<keyof StatusPageFormValues>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const statusPagesQuery = useQuery(
    statusPagesQueryOptions({
      page,
      limit: PAGE_SIZE,
    }),
  )
  const monitorsQuery = useQuery(monitorsQueryOptions())
  const statusPages = useMemo(() => statusPagesQuery.data?.items ?? [], [statusPagesQuery.data])
  const monitors = useMemo(() => monitorsQuery.data?.items ?? [], [monitorsQuery.data])
  const filteredStatusPages = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    if (!normalizedSearch) {
      return statusPages
    }

    return statusPages.filter((statusPage) =>
      [statusPage.name, statusPage.slug, statusPage.description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [searchValue, statusPages])
  const isEditing = Boolean(editingStatusPageId)
  const createMutation = useMutation({
    mutationFn: (payload: StatusPageFormValues) =>
      statusPageService.createStatusPage(toStatusPagePayload(payload)),
    onSuccess: async () => {
      resetForm()
      await queryClient.invalidateQueries({
        queryKey: statusPageQueryKeys.all,
      })
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error))
    },
  })
  const updateMutation = useMutation({
    mutationFn: (payload: StatusPageFormValues) =>
      editingStatusPageId
        ? statusPageService.updateStatusPage(editingStatusPageId, toStatusPagePayload(payload))
        : Promise.reject(new Error('Missing status page id')),
    onSuccess: async () => {
      resetForm()
      await queryClient.invalidateQueries({
        queryKey: statusPageQueryKeys.all,
      })
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error))
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (statusPageId: string) => statusPageService.deleteStatusPage(statusPageId),
    onSuccess: async () => {
      resetForm()
      await queryClient.invalidateQueries({
        queryKey: statusPageQueryKeys.all,
      })
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    try {
      const values = statusPageSchema.parse(formValues)
      setFieldErrors({})

      if (isEditing) {
        await updateMutation.mutateAsync(values)
      } else {
        await createMutation.mutateAsync(values)
      }
    } catch (error) {
      if (error instanceof ZodError) {
        setFieldErrors(getFieldErrors(error))
        return
      }

      setSubmitError(getErrorMessage(error))
    }
  }

  const startEditing = (statusPage: StatusPage) => {
    setEditingStatusPageId(statusPage.id)
    setFormValues({
      name: statusPage.name,
      slug: statusPage.slug,
      description: statusPage.description ?? '',
      isPublic: statusPage.isPublic,
      monitorIds: statusPage.monitors.map((monitor) => monitor.monitorId),
    })
    setFieldErrors({})
    setSubmitError(null)
  }

  const handleCopyLink = async (statusPage: StatusPage) => {
    const publicUrl = buildPublicStatusPageUrl(statusPage.slug)
    await navigator.clipboard.writeText(publicUrl)
    toast.success('Public link copied.', {
      description: publicUrl,
    })
  }

  const updateField = <TKey extends keyof StatusPageFormValues>(
    field: TKey,
    value: StatusPageFormValues[TKey],
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

  const toggleMonitor = (monitorId: string) => {
    const hasMonitor = formValues.monitorIds.includes(monitorId)

    updateField(
      'monitorIds',
      hasMonitor
        ? formValues.monitorIds.filter((id) => id !== monitorId)
        : [...formValues.monitorIds, monitorId],
    )
  }

  function resetForm() {
    setEditingStatusPageId(null)
    setFormValues(defaultFormValues)
    setFieldErrors({})
    setSubmitError(null)
  }

  return (
    <AppShell
      activeSection="status-pages"
      onSearchChange={setSearchValue}
      searchPlaceholder="Search status pages by name or slug"
      searchValue={searchValue}
      headerActions={
        <Button
          className="rounded-sm"
          onClick={() => void statusPagesQuery.refetch()}
          variant="outline"
        >
          <PanelTop className="size-4" />
          Refresh
        </Button>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-sm border border-border bg-card px-7 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/10 px-3 py-1.5">
            <PanelTop className="size-4 text-primary" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              Status Page Manager
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Status pages
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">
              Create public or private status pages and choose which monitors are exposed.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <OverviewTile label="Pages loaded" value={String(statusPagesQuery.data?.meta.total ?? 0)} />
            <OverviewTile
              label="Public pages"
              value={String(statusPages.filter((pageItem) => pageItem.isPublic).length)}
            />
            <OverviewTile label="Available monitors" value={String(monitors.length)} />
          </div>
        </div>

        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle>Status page notes</CardTitle>
            <CardDescription>
              Public pages are accessible without authentication at `/status/:slug`.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-sm border border-border bg-background px-4 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Public access
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                When `Public` is enabled, visitors can open the status page directly from the slug link.
              </p>
            </div>
            <div className="rounded-sm border border-border bg-background px-4 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Included monitors
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Only selected monitors are shown in the public view and contribute to the overall status.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <CardTitle>Status pages</CardTitle>
              <CardDescription>
                List, edit, delete and copy links for your status pages.
              </CardDescription>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Page {statusPagesQuery.data?.meta.page ?? 1} of {statusPagesQuery.data?.meta.totalPages ?? 1}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusPagesQuery.isError ? (
              <PageFeedback
                action={
                  <Button className="rounded-sm" onClick={() => void statusPagesQuery.refetch()}>
                    Retry loading status pages
                  </Button>
                }
                description="The status page list could not be loaded from the API."
                title="Unable to load status pages"
                variant="error"
              />
            ) : statusPagesQuery.isLoading && filteredStatusPages.length === 0 ? (
              <PageFeedback
                description="Loading your configured public and private status pages."
                title="Loading status pages"
                variant="loading"
              />
            ) : (
              <div className="space-y-3">
                {filteredStatusPages.length > 0 ? (
                filteredStatusPages.map((statusPage) => (
                  <article
                    className="rounded-sm border border-border bg-background px-4 py-4"
                    key={statusPage.id}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{statusPage.name}</p>
                          <StatusBadge isPublic={statusPage.isPublic} />
                          <OverallStatusBadge status={statusPage.overallStatus} />
                        </div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          /status/{statusPage.slug}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {statusPage.description ?? 'No description provided.'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {statusPage.monitors.length} monitor(s) included
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="rounded-sm"
                          onClick={() => void handleCopyLink(statusPage)}
                          variant="outline"
                        >
                          <Copy className="size-4" />
                          Copy link
                        </Button>
                        <Button
                          className="rounded-sm"
                          onClick={() => startEditing(statusPage)}
                          variant="outline"
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                        <Button
                          className="rounded-sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => void deleteMutation.mutateAsync(statusPage.id)}
                          variant="outline"
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </article>
                ))
                ) : (
                  <div className="rounded-sm border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                    No status pages found for this page or search.
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <Button
                className="rounded-sm"
                disabled={(statusPagesQuery.data?.meta.page ?? 1) <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                variant="outline"
              >
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                {statusPagesQuery.data?.meta.total ?? 0} total page(s)
              </p>
              <Button
                className="rounded-sm"
                disabled={
                  !statusPagesQuery.data ||
                  statusPagesQuery.data.meta.page >= statusPagesQuery.data.meta.totalPages
                }
                onClick={() => setPage((current) => current + 1)}
                variant="outline"
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle>{isEditing ? 'Edit status page' : 'Create status page'}</CardTitle>
            <CardDescription>
              Configure slug, visibility and included monitors.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
              <Field
                error={fieldErrors.name}
                label="Name"
                onChange={(value) => updateField('name', value)}
                placeholder="Production API"
                value={formValues.name}
              />
              <Field
                error={fieldErrors.slug}
                label="Slug"
                onChange={(value) => updateField('slug', value)}
                placeholder="production-api"
                value={formValues.slug}
              />
              <Field
                error={fieldErrors.description}
                label="Description"
                onChange={(value) => updateField('description', value)}
                placeholder="Public status page for customer-facing services"
                value={formValues.description ?? ''}
              />

              <label className="flex items-center justify-between rounded-sm border border-border bg-background px-4 py-4">
                <div>
                  <p className="font-medium text-foreground">Public visibility</p>
                  <p className="text-sm text-muted-foreground">
                    Enable public access at the shareable slug route.
                  </p>
                </div>
                <button
                  className="flex items-center gap-2 rounded-sm bg-primary/10 px-3 py-2 text-sm text-primary"
                  onClick={() => updateField('isPublic', !formValues.isPublic)}
                  type="button"
                >
                  {formValues.isPublic ? <Globe className="size-4" /> : <Lock className="size-4" />}
                  {formValues.isPublic ? 'Public' : 'Private'}
                </button>
              </label>

              <div className="space-y-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Included monitors
                </span>
                <div className="max-h-72 space-y-2 overflow-auto rounded-sm border border-border bg-background p-3">
                  {monitors.length > 0 ? (
                    monitors.map((monitor) => (
                      <MonitorOption
                        checked={formValues.monitorIds.includes(monitor.id)}
                        key={monitor.id}
                        monitor={monitor}
                        onToggle={() => toggleMonitor(monitor.id)}
                      />
                    ))
                  ) : (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No monitors available yet.
                    </div>
                  )}
                </div>
                {fieldErrors.monitorIds ? (
                  <span className="text-sm text-destructive">{fieldErrors.monitorIds}</span>
                ) : null}
              </div>

              {submitError ? (
                <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {submitError}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button className="rounded-sm" disabled={isSubmitting} type="submit">
                  {isEditing ? (
                    <>
                      <Pencil className="size-4" />
                      Save changes
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      Create status page
                    </>
                  )}
                </Button>
                {isEditing ? (
                  <Button className="rounded-sm" onClick={resetForm} type="button" variant="outline">
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  )
}

function Field({
  error,
  label,
  onChange,
  placeholder,
  value,
}: {
  error?: string | undefined
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <label className="grid gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <input
        className="h-11 rounded-sm border border-input bg-input px-3 text-sm text-foreground outline-none"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </label>
  )
}

function MonitorOption({
  checked,
  monitor,
  onToggle,
}: {
  checked: boolean
  monitor: Monitor
  onToggle: () => void
}) {
  return (
    <button
      className="flex w-full items-center justify-between rounded-sm border border-border bg-card px-3 py-3 text-left transition hover:border-primary/25"
      onClick={onToggle}
      type="button"
    >
      <div className="space-y-1">
        <p className="font-medium text-foreground">{monitor.name}</p>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {monitor.type} {monitor.url ? `• ${monitor.url}` : ''}
        </p>
      </div>
      <div className="flex size-8 items-center justify-center rounded-sm bg-primary/10 text-primary">
        {checked ? <Check className="size-4" /> : <Link2 className="size-4" />}
      </div>
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

function StatusBadge({ isPublic }: { isPublic: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-sm bg-primary/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
      {isPublic ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
      {isPublic ? 'Public' : 'Private'}
    </span>
  )
}

function OverallStatusBadge({ status }: { status: StatusPage['overallStatus'] }) {
  const styles: Record<StatusPage['overallStatus'], string> = {
    OPERATIONAL: 'bg-primary/10 text-primary',
    DEGRADED: 'bg-amber-400/15 text-amber-500',
    OUTAGE: 'bg-destructive/10 text-destructive',
    UNKNOWN: 'bg-secondary/20 text-secondary-foreground',
  }

  return (
    <span className={`inline-flex rounded-sm px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] ${styles[status]}`}>
      {status}
    </span>
  )
}

function toStatusPagePayload(values: StatusPageFormValues) {
  const description = values.description?.trim()

  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    isPublic: values.isPublic,
    monitorIds: values.monitorIds,
    ...(description ? { description } : {}),
  }
}

function buildPublicStatusPageUrl(slug: string): string {
  const appOrigin = window.location.origin || env.VITE_API_BASE_URL

  return `${appOrigin}/status/${slug}`
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to save the status page right now.'
}
