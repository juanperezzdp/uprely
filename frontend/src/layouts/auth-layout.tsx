import type { PropsWithChildren } from 'react'
import { Logo } from '@/components/app/logo'

type AuthLayoutProps = PropsWithChildren<{
  title: string
  description: string
}>

export function AuthLayout({
  children,
  description,
  title,
}: AuthLayoutProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100svh-7rem)] max-w-6xl items-center">
      <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden rounded-sm border border-border bg-card p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-8">
            <Logo />
            <div className="space-y-4">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">
                Visual Reference
              </p>
              <h2 className="max-w-md text-4xl font-semibold tracking-tight text-foreground">
                High-contrast technical minimalism inspired by the Stitch
                templates.
              </h2>
              <p className="max-w-xl text-base text-muted-foreground">
                La base de autenticacion ya comparte los mismos tokens de color,
                tipografia y densidad visual del dashboard principal.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Sessions', 'Cookies httpOnly'],
              ['Routing', 'TanStack Router'],
              ['Server State', 'TanStack Query'],
              ['Theming', 'Light / Dark / System'],
            ].map(([label, value]) => (
              <div className="rounded-sm border border-border bg-background p-4" key={label}>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-3 text-xl font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-sm border border-border bg-card p-6 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_10%,transparent)] sm:p-8">
          <div className="mb-8 space-y-3">
            <Logo className="lg:hidden" />
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">
              Authentication
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-base text-muted-foreground">{description}</p>
          </div>

          {children}
        </section>
      </div>
    </div>
  )
}
