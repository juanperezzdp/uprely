import { useRouter } from '@tanstack/react-router'
import {
  Bell,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorCog,
  PanelTop,
  Search,
  ShieldAlert,
  Signal,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { MonitorDownAlerts } from '@/components/app/monitor-down-alerts'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'

type AppShellSection =
  | 'dashboard'
  | 'monitors'
  | 'alerts'
  | 'status-pages'
  | 'incidents'
  | 'billing'

type AppShellProps = {
  activeSection: AppShellSection
  children: ReactNode
  headerActions?: ReactNode
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
}

const navigationItems: Array<{
  label: string
  description: string
  icon: LucideIcon
  route: '/dashboard' | '/alerts' | '/status-pages' | '/incidents' | '/billing'
  section: AppShellSection
}> = [
  {
    label: 'Dashboard',
    description: 'Portfolio overview',
    icon: LayoutDashboard,
    route: '/dashboard',
    section: 'dashboard',
  },
  {
    label: 'Monitors',
    description: 'Uptime targets',
    icon: MonitorCog,
    route: '/dashboard',
    section: 'monitors',
  },
  {
    label: 'Alerts',
    description: 'Notification contacts',
    icon: Bell,
    route: '/alerts',
    section: 'alerts',
  },
  {
    label: 'Status Pages',
    description: 'Public status sites',
    icon: PanelTop,
    route: '/status-pages',
    section: 'status-pages',
  },
  {
    label: 'Billing',
    description: 'Plans and checkout',
    icon: CreditCard,
    route: '/billing',
    section: 'billing',
  },
  {
    label: 'Incidents',
    description: 'Response history',
    icon: ShieldAlert,
    route: '/incidents',
    section: 'incidents',
  },
] as const

export function AppShell({
  activeSection,
  children,
  headerActions,
  onSearchChange,
  searchPlaceholder = 'Search',
  searchValue = '',
}: AppShellProps) {
  const router = useRouter()
  const { isLoggingOut, logout, user } = useAuth()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const showSearch = Boolean(onSearchChange)
  const connectionState = useMemo(() => 'Authenticated', [])

  const handleLogout = async () => {
    await logout()
    await router.navigate({ to: '/' })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MonitorDownAlerts enabled={Boolean(user)} />

      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity lg:hidden',
          isMobileSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-border bg-card/95 backdrop-blur-xl transition-all duration-300',
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'w-72 lg:translate-x-0',
          isSidebarCollapsed ? 'lg:w-24' : 'lg:w-72',
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-6">
          <div className={cn('space-y-1', isSidebarCollapsed && 'lg:hidden')}>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
              Uprely
            </p>
            <h1 className="text-xl font-black uppercase tracking-[0.18em] text-foreground">
              Monitoring Engine
            </h1>
          </div>
          <Button
            className="lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
            size="icon"
            variant="ghost"
          >
            <X className="size-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-6">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = item.section === activeSection

            return (
              <button
                className={cn(
                  'flex w-full items-center gap-3 rounded-sm px-4 py-3 text-left transition-colors',
                  isActive
                    ? 'bg-primary/12 text-primary'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground',
                  isSidebarCollapsed && 'lg:justify-center lg:px-0',
                )}
                key={item.label}
                onClick={() => void router.navigate({ to: item.route })}
                type="button"
              >
                <Icon className="size-5 shrink-0" />
                <div className={cn('min-w-0', isSidebarCollapsed && 'lg:hidden')}>
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </button>
            )
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div
            className={cn(
              'rounded-sm border border-border bg-background/70 p-4',
              isSidebarCollapsed && 'lg:p-3',
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-sm bg-primary/12 text-primary">
                <Signal className="size-5" />
              </div>
              <div className={cn('min-w-0', isSidebarCollapsed && 'lg:hidden')}>
                <p className="truncate text-sm font-semibold text-foreground">
                  {user?.email ?? 'Unknown user'}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {user?.plan ?? 'FREE'} plan
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div
        className={cn(
          'min-h-screen transition-[padding-left] duration-300',
          isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-72',
        )}
      >
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <Button
                className="lg:hidden"
                onClick={() => setIsMobileSidebarOpen(true)}
                size="icon"
                variant="outline"
              >
                <Menu className="size-5" />
              </Button>
              <Button
                className="hidden lg:inline-flex"
                onClick={() => setIsSidebarCollapsed((current) => !current)}
                size="icon"
                variant="outline"
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="size-5" />
                ) : (
                  <ChevronLeft className="size-5" />
                )}
              </Button>

              {showSearch ? (
                <div className="relative min-w-0 flex-1 xl:w-[28rem]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-12 rounded-sm border-border bg-card pl-11 font-mono text-xs uppercase tracking-[0.16em]"
                    onChange={(event) => onSearchChange?.(event.target.value)}
                    placeholder={searchPlaceholder}
                    value={searchValue}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-sm bg-primary/12 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                <Signal className="size-3.5" />
                {connectionState}
              </div>
              <ThemeToggle />
              {headerActions}
              <Button
                className="rounded-sm"
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
                variant="outline"
              >
                <LogOut className="size-4" />
                {isLoggingOut ? 'Signing out...' : 'Sign out'}
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
