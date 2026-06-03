import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import {
  AlertCircle,
  Check,
  Clock3,
  CreditCard,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app/app-shell'
import { PageFeedback } from '@/components/app/page-feedback'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { billingPlansQueryOptions, billingQueryKeys, billingService } from '@/services/billing/billing-service'
import { ApiError } from '@/services/http/api-client'
import { authQueryKey } from '@/services/auth/auth-service'
import type { BillingPlan } from '@/types/billing'

const FEATURE_MATRIX: Record<BillingPlan['plan'], string[]> = {
  FREE: [
    'Up to 5 monitors',
    'Minimum interval of 300 seconds',
    '1 alert contact',
    'Secure cookie-based authentication',
  ],
  PRO: [
    'Up to 50 monitors',
    'Minimum interval of 60 seconds',
    '10 alert contacts',
    'Priority-ready plan for production monitoring',
  ],
}

export function BillingPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { refresh, user } = useAuth()
  const plansQuery = useQuery(billingPlansQueryOptions())
  const hasHandledReturnRef = useRef(false)
  const checkoutMutation = useMutation({
    mutationFn: () =>
      billingService.createCheckout({
        plan: 'PRO',
      }),
    onSuccess: async (response) => {
      toast.success('Redirecting to Dodo Payments checkout...')
      window.location.assign(response.checkoutUrl)
      await Promise.resolve()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
  const plans = plansQuery.data?.plans ?? []
  const currentPlan = plans.find((plan) => plan.isCurrent) ?? null
  const renewalDate = useMemo(() => {
    if (user?.plan !== 'PRO') {
      return '--'
    }

    return 'Managed by Dodo Payments'
  }, [user?.plan])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const paymentStatus = searchParams.get('status')
    const checkoutSessionId = searchParams.get('checkout_id') ?? searchParams.get('session_id')

    if (!paymentStatus || hasHandledReturnRef.current) {
      return
    }

    hasHandledReturnRef.current = true

    const handleReturn = async () => {
      await queryClient.invalidateQueries({
        queryKey: billingQueryKeys.all,
      })
      await queryClient.invalidateQueries({
        queryKey: authQueryKey,
      })
      await refresh()

      if (paymentStatus === 'succeeded' || paymentStatus === 'success') {
        toast.success('Payment completed. Refreshing your plan...')
      } else {
        toast.error('Checkout did not complete successfully.')
      }

      if (checkoutSessionId) {
        void router.navigate({
          to: '/billing',
          search: {},
          replace: true,
        })
      }
    }

    void handleReturn()
  }, [queryClient, refresh, router])

  if (plansQuery.isError) {
    return (
      <AppShell activeSection="billing">
        <PageFeedback
          action={
            <Button className="rounded-sm" onClick={() => void plansQuery.refetch()}>
              Retry loading billing
            </Button>
          }
          description="The billing module could not load plan data from the backend."
          title="Unable to load billing"
          variant="error"
        />
      </AppShell>
    )
  }

  if (plansQuery.isLoading && plans.length === 0) {
    return (
      <AppShell activeSection="billing">
        <PageFeedback
          description="Loading plans, checkout availability and your current subscription snapshot."
          title="Loading billing"
          variant="loading"
        />
      </AppShell>
    )
  }

  return (
    <AppShell
      activeSection="billing"
      headerActions={
        <Button
          className="rounded-sm"
          onClick={() => void plansQuery.refetch()}
          variant="outline"
        >
          <CreditCard className="size-4" />
          Refresh
        </Button>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-sm border border-border bg-card px-7 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/10 px-3 py-1.5">
            <CreditCard className="size-4 text-primary" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              Subscription Billing
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Billing and subscriptions
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">
              Compare plans, confirm your current subscription and upgrade to PRO through Dodo Payments.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <OverviewTile label="Current plan" value={user?.plan ?? currentPlan?.plan ?? 'FREE'} />
            <OverviewTile label="Renewal" value={renewalDate} />
            <OverviewTile label="Provider" value={plansQuery.data?.provider ?? 'DODO_PAYMENTS'} />
          </div>
        </div>

        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle>Billing notes</CardTitle>
            <CardDescription>
              Upgrade is handled by hosted checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <InfoRow
              icon={ShieldCheck}
              title="Current plan sync"
              description="The displayed plan is refreshed from your authenticated session after returning from checkout."
            />
            <InfoRow
              icon={Clock3}
              title="Renewal date"
              description="The current backend contract does not expose a renewal timestamp yet."
            />
            <InfoRow
              icon={AlertCircle}
              title="Payment history"
              description="Not implemented because this backend does not currently expose Dodo payment history endpoints, even though Dodo has customer billing history capabilities in its platform [Dodo Customer Management](https://docs.dodopayments.com/features/customers)."
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        {plans.map((plan) => (
          <PlanCard
            checkoutLoading={checkoutMutation.isPending}
            isCurrentPlan={plan.isCurrent}
            key={plan.plan}
            onUpgrade={() => void checkoutMutation.mutateAsync()}
            plan={plan}
          />
        ))}
      </section>

      <section className="mt-8">
        <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle>Current subscription</CardTitle>
            <CardDescription>
              Snapshot of the authenticated user billing state.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailTile
              icon={CreditCard}
              label="Plan"
              value={user?.plan ?? currentPlan?.plan ?? '--'}
            />
            <DetailTile
              icon={Sparkles}
              label="Checkout available"
              value={plans.find((plan) => plan.plan === 'PRO')?.checkoutAvailable ? 'Yes' : 'No'}
            />
            <DetailTile
              icon={Clock3}
              label="Renewal date"
              value={renewalDate}
            />
            <DetailTile
              icon={Zap}
              label="Upgrade state"
              value={checkoutMutation.isPending ? 'Processing' : 'Ready'}
            />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  )
}

function PlanCard({
  checkoutLoading,
  isCurrentPlan,
  onUpgrade,
  plan,
}: {
  checkoutLoading: boolean
  isCurrentPlan: boolean
  onUpgrade: () => void
  plan: BillingPlan
}) {
  const canUpgrade = plan.plan === 'PRO' && !isCurrentPlan && plan.checkoutAvailable

  return (
    <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle>{plan.displayName}</CardTitle>
            <CardDescription>
              {isCurrentPlan ? 'This is your current plan.' : 'Available for upgrade.'}
            </CardDescription>
          </div>
          <span
            className={`inline-flex rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] ${
              isCurrentPlan
                ? 'bg-primary/12 text-primary'
                : 'bg-secondary/20 text-secondary-foreground'
            }`}
          >
            {isCurrentPlan ? 'Current' : 'Available'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <PlanLimit label="Max monitors" value={String(plan.limits.maxMonitors)} />
          <PlanLimit
            label="Min interval"
            value={`${plan.limits.minMonitorIntervalSeconds}s`}
          />
          <PlanLimit
            label="Alert contacts"
            value={String(plan.limits.maxAlertContacts)}
          />
        </div>

        <div className="space-y-2">
          {FEATURE_MATRIX[plan.plan].map((feature) => (
            <div className="flex items-center gap-3 text-sm text-muted-foreground" key={feature}>
              <div className="flex size-7 items-center justify-center rounded-sm bg-primary/10 text-primary">
                <Check className="size-4" />
              </div>
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {plan.plan === 'PRO' ? (
          <Button
            className="w-full rounded-sm"
            disabled={!canUpgrade || checkoutLoading}
            onClick={onUpgrade}
          >
            {checkoutLoading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Redirecting...
              </>
            ) : isCurrentPlan ? (
              <>
                <ShieldCheck className="size-4" />
                Current plan
              </>
            ) : (
              <>
                <CreditCard className="size-4" />
                Upgrade to PRO
              </>
            )}
          </Button>
        ) : (
          <Button className="w-full rounded-sm" disabled variant="outline">
            <ShieldCheck className="size-4" />
            Included by default
          </Button>
        )}
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

function PlanLimit({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-sm border border-border bg-background px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  )
}

function DetailTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CreditCard
  label: string
  value: string
}) {
  return (
    <div className="rounded-sm border border-border bg-background px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 font-medium text-foreground">{value}</p>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  description,
  icon: Icon,
  title,
}: {
  description: string
  icon: typeof CreditCard
  title: string
}) {
  return (
    <div className="rounded-sm border border-border bg-background px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to start the checkout session right now.'
}
