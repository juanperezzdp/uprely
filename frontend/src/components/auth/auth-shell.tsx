import type { PropsWithChildren } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo } from '@/components/app/logo'

type AuthShellProps = PropsWithChildren<{
  title: string
  description: string
  footerPrompt: string
  footerLinkLabel: string
  footerLinkTo: '/login' | '/register'
}>

export function AuthShell({
  children,
  description,
  footerLinkLabel,
  footerLinkTo,
  footerPrompt,
  title,
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AuthBackdrop />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-6 py-10">
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-8">
          <header className="flex flex-col items-center gap-4 text-center">
            <Logo className="[&_p:last-child]:hidden [&_svg]:size-6" />
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
          </header>

          {children}

          <footer className="text-center">
            <p className="text-sm text-muted-foreground">
              {footerPrompt}{' '}
              <Link
                className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary transition hover:opacity-90"
                to={footerLinkTo}
              >
                {footerLinkLabel}
              </Link>
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}

function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(var(--color-primary)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="absolute -right-24 -top-24 size-[28rem] rounded-sm bg-primary/10 blur-[120px]" />
      <div className="absolute -bottom-28 -left-24 size-[28rem] rounded-sm bg-primary/10 blur-[120px]" />
    </div>
  )
}
