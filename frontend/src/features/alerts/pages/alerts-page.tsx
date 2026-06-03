import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Mail, Pencil, Phone, Plus, Trash2, Webhook } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ZodError } from 'zod'
import { AppShell } from '@/components/app/app-shell'
import { PageFeedback } from '@/components/app/page-feedback'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getFieldErrors, type FormErrors } from '@/features/auth/lib/form-errors'
import {
  alertContactSchema,
  getPlaceholderByType,
  type AlertContactFormValues,
} from '@/features/alerts/lib/alert-schemas'
import { useAuth } from '@/hooks/use-auth'
import { alertContactsQueryOptions, alertQueryKeys, alertService } from '@/services/alerts/alert-service'
import { ApiError } from '@/services/http/api-client'
import type { AlertContact, AlertContactType } from '@/types/alert'

const PAGE_SIZE = 10

const PLAN_LIMITS = {
  FREE: 1,
  PRO: 10,
} as const

const defaultFormValues: AlertContactFormValues = {
  type: 'EMAIL',
  value: '',
}

export function AlertsPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<AlertContactFormValues>(defaultFormValues)
  const [fieldErrors, setFieldErrors] = useState<FormErrors<keyof AlertContactFormValues>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const alertsQuery = useQuery(
    alertContactsQueryOptions({
      page,
      limit: PAGE_SIZE,
    }),
  )
  const contacts = useMemo(() => alertsQuery.data?.items ?? [], [alertsQuery.data])
  const filteredContacts = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    if (!normalizedSearch) {
      return contacts
    }

    return contacts.filter((contact) =>
      [contact.type, contact.value].join(' ').toLowerCase().includes(normalizedSearch),
    )
  }, [contacts, searchValue])
  const maxContacts = user ? PLAN_LIMITS[user.plan] : PLAN_LIMITS.FREE
  const currentContacts = alertsQuery.data?.meta.total ?? 0
  const canCreateMore = currentContacts < maxContacts
  const isEditing = Boolean(editingContactId)

  const createMutation = useMutation({
    mutationFn: (payload: AlertContactFormValues) => alertService.createAlertContact(payload),
    onSuccess: async () => {
      resetForm()
      await queryClient.invalidateQueries({
        queryKey: alertQueryKeys.all,
      })
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error))
    },
  })
  const updateMutation = useMutation({
    mutationFn: (payload: AlertContactFormValues) =>
      editingContactId
        ? alertService.updateAlertContact(editingContactId, payload)
        : Promise.reject(new Error('Missing alert contact id')),
    onSuccess: async () => {
      resetForm()
      await queryClient.invalidateQueries({
        queryKey: alertQueryKeys.all,
      })
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error))
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (alertContactId: string) => alertService.deleteAlertContact(alertContactId),
    onSuccess: async () => {
      if (editingContactId) {
        resetForm()
      }
      await queryClient.invalidateQueries({
        queryKey: alertQueryKeys.all,
      })
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    try {
      const values = alertContactSchema.parse(formValues)
      setFieldErrors({})

      if (isEditing) {
        await updateMutation.mutateAsync(values)
        return
      }

      if (!canCreateMore) {
        setSubmitError(`Plan ${user?.plan ?? 'FREE'} reached the alert contact limit.`)
        return
      }

      await createMutation.mutateAsync(values)
    } catch (error) {
      if (error instanceof ZodError) {
        setFieldErrors(getFieldErrors(error))
        return
      }

      setSubmitError(getErrorMessage(error))
    }
  }

  const startEditing = (contact: AlertContact) => {
    setEditingContactId(contact.id)
    setFormValues({
      type: contact.type,
      value: contact.value,
    })
    setFieldErrors({})
    setSubmitError(null)
  }

  const updateField = <TKey extends keyof AlertContactFormValues>(
    field: TKey,
    value: AlertContactFormValues[TKey],
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

  function resetForm() {
    setEditingContactId(null)
    setFormValues(defaultFormValues)
    setFieldErrors({})
    setSubmitError(null)
  }

  return (
    <AppShell
      activeSection="alerts"
      onSearchChange={setSearchValue}
      searchPlaceholder="Search contacts by type or value"
      searchValue={searchValue}
      headerActions={
        <Button
          className="rounded-sm"
          onClick={() => void alertsQuery.refetch()}
          variant="outline"
        >
          <Bell className="size-4" />
          Refresh
        </Button>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-sm border border-border bg-card px-7 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/10 px-3 py-1.5">
            <Bell className="size-4 text-primary" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              Notification Contacts
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Alert contacts
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">
              Manage email, SMS and webhook recipients for uptime notifications.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <OverviewTile label="Current plan" value={user?.plan ?? 'FREE'} />
            <OverviewTile label="Usage" value={`${currentContacts} / ${maxContacts}`} />
            <OverviewTile label="Can create more" value={canCreateMore ? 'Yes' : 'No'} />
          </div>
        </div>

        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle>Plan limits</CardTitle>
            <CardDescription>Visible limits for alert contacts by plan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <LimitCard current={Math.min(currentContacts, PLAN_LIMITS.FREE)} max={PLAN_LIMITS.FREE} plan="FREE" />
            <LimitCard current={Math.min(currentContacts, PLAN_LIMITS.PRO)} max={PLAN_LIMITS.PRO} plan="PRO" />
            <div className="rounded-sm border border-border bg-background px-4 py-4 text-sm text-muted-foreground">
              {canCreateMore
                ? `You can still create ${maxContacts - currentContacts} contact(s) on the ${user?.plan ?? 'FREE'} plan.`
                : `Creation is blocked because the ${user?.plan ?? 'FREE'} plan limit was reached.`}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <CardTitle>Contacts</CardTitle>
              <CardDescription>
                CRUD for notification endpoints with live plan-aware limits.
              </CardDescription>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Page {alertsQuery.data?.meta.page ?? 1} of {alertsQuery.data?.meta.totalPages ?? 1}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {alertsQuery.isError ? (
              <PageFeedback
                action={
                  <Button className="rounded-sm" onClick={() => void alertsQuery.refetch()}>
                    Retry loading contacts
                  </Button>
                }
                description="The alert contacts list could not be loaded from the API."
                title="Unable to load alert contacts"
                variant="error"
              />
            ) : alertsQuery.isLoading && filteredContacts.length === 0 ? (
              <PageFeedback
                description="Loading notification contacts and current plan usage."
                title="Loading alert contacts"
                variant="loading"
              />
            ) : (
              <div className="space-y-3">
                {filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => (
                  <article
                    className="rounded-sm border border-border bg-background px-4 py-4"
                    key={contact.id}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 items-center justify-center rounded-sm bg-primary/10 text-primary">
                          <ContactIcon type={contact.type} />
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{contact.value}</p>
                          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {contact.type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Created {formatCreatedAt(contact.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="rounded-sm"
                          onClick={() => startEditing(contact)}
                          variant="outline"
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                        <Button
                          className="rounded-sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => void deleteMutation.mutateAsync(contact.id)}
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
                    No alert contacts found for this page or search.
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <Button
                className="rounded-sm"
                disabled={(alertsQuery.data?.meta.page ?? 1) <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                variant="outline"
              >
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                {alertsQuery.data?.meta.total ?? 0} total contact(s)
              </p>
              <Button
                className="rounded-sm"
                disabled={
                  !alertsQuery.data ||
                  alertsQuery.data.meta.page >= alertsQuery.data.meta.totalPages
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
            <CardTitle>{isEditing ? 'Edit contact' : 'Create contact'}</CardTitle>
            <CardDescription>
              Supported types: EMAIL, SMS and WEBHOOK.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
              <label className="grid gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Type
                </span>
                <select
                  className="h-11 rounded-sm border border-input bg-input px-3 text-sm text-foreground outline-none"
                  onChange={(event) =>
                    updateField('type', event.target.value as AlertContactType)
                  }
                  value={formValues.type}
                >
                  <option value="EMAIL">EMAIL</option>
                  <option value="SMS">SMS</option>
                  <option value="WEBHOOK">WEBHOOK</option>
                </select>
                {fieldErrors.type ? (
                  <span className="text-sm text-destructive">{fieldErrors.type}</span>
                ) : null}
              </label>

              <label className="grid gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Value
                </span>
                <input
                  className="h-11 rounded-sm border border-input bg-input px-3 text-sm text-foreground outline-none"
                  onChange={(event) => updateField('value', event.target.value)}
                  placeholder={getPlaceholderByType(formValues.type)}
                  value={formValues.value}
                />
                {fieldErrors.value ? (
                  <span className="text-sm text-destructive">{fieldErrors.value}</span>
                ) : null}
              </label>

              <div className="rounded-sm border border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                {getValidationHint(formValues.type)}
              </div>

              {submitError ? (
                <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {submitError}
                </div>
              ) : null}

              {!isEditing && !canCreateMore ? (
                <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  You reached the maximum number of contacts for the {user?.plan ?? 'FREE'} plan.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-sm"
                  disabled={isSubmitting || (!isEditing && !canCreateMore)}
                  type="submit"
                >
                  {isEditing ? (
                    <>
                      <Pencil className="size-4" />
                      Save changes
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      Create contact
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

function LimitCard({
  current,
  max,
  plan,
}: {
  current: number
  max: number
  plan: 'FREE' | 'PRO'
}) {
  return (
    <div className="rounded-sm border border-border bg-background px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {plan}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {current} / {max}
      </p>
    </div>
  )
}

function ContactIcon({ type }: { type: AlertContactType }) {
  if (type === 'EMAIL') {
    return <Mail className="size-5" />
  }

  if (type === 'SMS') {
    return <Phone className="size-5" />
  }

  return <Webhook className="size-5" />
}

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function getValidationHint(type: AlertContactType): string {
  switch (type) {
    case 'EMAIL':
      return 'EMAIL requires a valid email format like alerts@company.com.'
    case 'SMS':
      return 'SMS requires a valid E.164 phone number like +15551234567.'
    case 'WEBHOOK':
      return 'WEBHOOK requires a valid absolute http or https URL.'
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to save the alert contact right now.'
}
