import { AlertTriangle, Inbox, LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type PageFeedbackProps = {
  title: string
  description: string
  action?: ReactNode
  icon?: LucideIcon
  variant?: 'loading' | 'error' | 'empty'
}

export function PageFeedback({
  action,
  description,
  icon,
  title,
  variant = 'empty',
}: PageFeedbackProps) {
  const CustomIcon = icon

  return (
    <Card className="rounded-sm bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
      <CardHeader>
        <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
          {CustomIcon ? (
            <CustomIcon className={variant === 'loading' ? 'size-5 animate-spin' : 'size-5'} />
          ) : variant === 'loading' ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : variant === 'error' ? (
            <AlertTriangle className="size-5" />
          ) : (
            <Inbox className="size-5" />
          )}
        </div>
        <CardTitle className="pt-2">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action ? (
        <CardContent className="pt-0">
          {action}
        </CardContent>
      ) : null}
    </Card>
  )
}
