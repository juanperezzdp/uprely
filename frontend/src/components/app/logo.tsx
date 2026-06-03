import { ActivitySquare } from 'lucide-react'
import { cn } from '@/lib/cn'

type LogoProps = {
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex size-10 items-center justify-center rounded-sm border border-border bg-primary/15 text-primary">
        <ActivitySquare className="size-5" />
      </div>
      <div className="space-y-0.5">
        <p className="font-mono text-sm font-bold uppercase tracking-[0.28em] text-primary">
          UptimeWatch
        </p>
        <p className="text-sm text-muted-foreground">Monitoring Engine</p>
      </div>
    </div>
  )
}
