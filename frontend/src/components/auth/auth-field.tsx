import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string | undefined
  label?: string | undefined
  icon: ReactNode
  wrapperClassName?: string | undefined
}

export function AuthField({
  className,
  error,
  icon,
  label,
  wrapperClassName,
  ...props
}: AuthFieldProps) {
  return (
    <label className={cn('flex flex-col gap-2', wrapperClassName)}>
      {label ? (
        <span className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
          {label}
        </span>
      ) : null}
      <div
        className={cn(
          'auth-input-shell',
          error ? 'border-destructive/70 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]' : null,
        )}
      >
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <input
          aria-invalid={Boolean(error)}
          className={cn(
            'h-12 w-full bg-transparent pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/40',
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <span className="text-sm text-destructive">{error}</span>
      ) : null}
    </label>
  )
}
