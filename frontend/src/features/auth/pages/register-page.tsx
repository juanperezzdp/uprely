import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { Cloud, KeyRound, LoaderCircle, Mail, UserRound } from 'lucide-react'
import { useState } from 'react'
import { ZodError } from 'zod'
import { AuthField } from '@/components/auth/auth-field'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { getFieldErrors, type FormErrors } from '@/features/auth/lib/form-errors'
import {
  registerSchema,
  type RegisterFormValues,
} from '@/features/auth/lib/auth-schemas'
import { authQueryKey, authService } from '@/services/auth/auth-service'
import { ApiError } from '@/services/http/api-client'

export function RegisterPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [formValues, setFormValues] = useState<RegisterFormValues>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FormErrors<keyof RegisterFormValues>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const registerMutation = useMutation({
    mutationFn: (values: RegisterFormValues) =>
      authService.register({
        email: values.email,
        password: values.password,
      }),
    onSuccess: async (user) => {
      queryClient.setQueryData(authQueryKey, user)
      await router.navigate({ to: '/dashboard' })
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error))
    },
  })

  const updateField = <TKey extends keyof RegisterFormValues>(
    field: TKey,
    value: RegisterFormValues[TKey],
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
      const values = registerSchema.parse(formValues)
      setFieldErrors({})
      await registerMutation.mutateAsync(values)
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
      description="Deploy and monitor with precision. Join the high-performance network."
      footerLinkLabel="Log in here"
      footerLinkTo="/login"
      footerPrompt="Already part of the system?"
      title="Create your infrastructure account"
    >
      <section className="glass-panel rounded-sm p-6 sm:p-8">
        <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
          <AuthField
            autoComplete="name"
            error={fieldErrors.name}
            icon={<UserRound className="size-4" />}
            label="Full Name"
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="John Doe"
            type="text"
            value={formValues.name}
          />
          <AuthField
            autoComplete="email"
            error={fieldErrors.email}
            icon={<Mail className="size-4" />}
            label="Work Email"
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="name@company.com"
            type="email"
            value={formValues.email}
          />
          <AuthField
            autoComplete="new-password"
            error={fieldErrors.password}
            icon={<KeyRound className="size-4" />}
            label="Password"
            onChange={(event) => updateField('password', event.target.value)}
            placeholder="••••••••"
            type="password"
            value={formValues.password}
          />
          <AuthField
            autoComplete="new-password"
            error={fieldErrors.confirmPassword}
            icon={<KeyRound className="size-4" />}
            label="Confirm Password"
            onChange={(event) => updateField('confirmPassword', event.target.value)}
            placeholder="••••••••"
            type="password"
            value={formValues.confirmPassword}
          />

          <label className="mt-1 flex items-start gap-3 text-sm leading-6 text-muted-foreground">
            <span>
              I agree to the{' '}
              <a className="text-primary transition hover:underline" href="#">
                Terms of Service
              </a>{' '}
              and{' '}
              <a className="text-primary transition hover:underline" href="#">
                Privacy Policy
              </a>{' '}
              regarding my telemetry data.
            </span>
          </label>

          {submitError ? (
            <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {submitError}
            </div>
          ) : null}

          <Button
            className="mt-2 h-12 w-full rounded-sm font-mono text-xs font-bold uppercase tracking-[0.26em]"
            disabled={registerMutation.isPending}
            type="submit"
          >
            {registerMutation.isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Initialize Account'
            )}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Or register with
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-border text-sm text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled
            type="button"
          >
            <UserRound className="size-4" />
            <span className="font-mono text-xs uppercase tracking-[0.18em]">GitHub</span>
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-border text-sm text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled
            type="button"
          >
            <Cloud className="size-4" />
            <span className="font-mono text-xs uppercase tracking-[0.18em]">SSO</span>
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

  return 'Unable to create your account right now. Please try again.'
}
