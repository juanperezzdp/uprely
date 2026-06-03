import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { Cloud, KeyRound, LoaderCircle, Mail } from 'lucide-react'
import { useState } from 'react'
import { ZodError } from 'zod'
import { AuthField } from '@/components/auth/auth-field'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { getFieldErrors, type FormErrors } from '@/features/auth/lib/form-errors'
import {
  loginSchema,
  type LoginFormValues,
} from '@/features/auth/lib/auth-schemas'
import { authQueryKey, authService } from '@/services/auth/auth-service'
import { ApiError } from '@/services/http/api-client'

export function LoginPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [formValues, setFormValues] = useState<LoginFormValues>({
    email: '',
    password: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FormErrors<keyof LoginFormValues>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) => authService.login(values),
    onSuccess: async (user) => {
      queryClient.setQueryData(authQueryKey, user)
      await router.navigate({ to: '/dashboard' })
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error))
    },
  })

  const updateField = <TKey extends keyof LoginFormValues>(
    field: TKey,
    value: LoginFormValues[TKey],
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    try {
      const values = loginSchema.parse(formValues)
      setFieldErrors({})
      await loginMutation.mutateAsync(values)
    } catch (error) {
      if (error instanceof ZodError) {
        setFieldErrors(getFieldErrors(error))
        return
      }

      setSubmitError(getErrorMessage(error))
    }
  }

  return (
    <AuthShell
      description="System access required for telemetry monitoring."
      footerLinkLabel="Create an account"
      footerLinkTo="/register"
      footerPrompt="New to the monitoring system?"
      title="Welcome Back"
    >
      <section className="glass-panel rounded-sm p-6 sm:p-8">
        <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
          <AuthField
            autoComplete="email"
            error={fieldErrors.email}
            icon={<Mail className="size-4" />}
            label="Work Email"
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="name@domain.com"
            type="email"
            value={formValues.email}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Password
              </span>
              <a
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary transition hover:underline"
                href="#"
              >
                Forgot password
              </a>
            </div>
            <AuthField
              autoComplete="current-password"
              error={fieldErrors.password}
              icon={<KeyRound className="size-4" />}
              label=""
              onChange={(event) => updateField('password', event.target.value)}
              placeholder="••••••••"
              type="password"
              value={formValues.password}
              wrapperClassName="gap-0"
            />
          </div>

          {submitError ? (
            <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {submitError}
            </div>
          ) : null}

          <Button
            className="mt-2 h-12 w-full rounded-sm font-mono text-xs font-bold uppercase tracking-[0.26em]"
            disabled={loginMutation.isPending}
            type="submit"
          >
            {loginMutation.isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Signing In...
              </>
            ) : (
              'Initialize Session'
            )}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Or continue with
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-border text-sm text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled
            type="button"
          >
            <KeyRound className="size-4" />
            <span className="font-mono text-xs uppercase tracking-[0.18em]">SSO</span>
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-border text-sm text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled
            type="button"
          >
            <Cloud className="size-4" />
            <span className="font-mono text-xs uppercase tracking-[0.18em]">Azure</span>
          </button>
        </div>
      </section>
    </AuthShell>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to sign in right now. Please try again.'
}
