import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { queryClient } from '@/app/query-client'
import {
  redirectIfAuthenticated,
  requireAuth,
} from '@/features/auth/lib/auth-guards'
import { AlertsRouteComponent } from '@/routes/alerts'
import { BillingRouteComponent } from '@/routes/billing'
import { RootLayout } from '@/layouts/root-layout'
import { DashboardRouteComponent } from '@/routes/dashboard'
import { IncidentDetailRouteComponent } from '@/routes/incident-detail'
import { IncidentsRouteComponent } from '@/routes/incidents'
import { IndexRouteComponent } from '@/routes/index'
import { LoginRouteComponent } from '@/routes/login'
import { MonitorDetailRouteComponent } from '@/routes/monitor-detail'
import { PublicStatusRouteComponent } from '@/routes/public-status'
import { RegisterRouteComponent } from '@/routes/register'
import { StatusPagesRouteComponent } from '@/routes/status-pages'

type RouterContext = {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexRouteComponent,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async ({ context }) => {
    await redirectIfAuthenticated(context.queryClient)
  },
  component: LoginRouteComponent,
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  beforeLoad: async ({ context }) => {
    await redirectIfAuthenticated(context.queryClient)
  },
  component: RegisterRouteComponent,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: async ({ context }) => {
    await requireAuth(context.queryClient)
  },
  component: DashboardRouteComponent,
})

const alertsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/alerts',
  beforeLoad: async ({ context }) => {
    await requireAuth(context.queryClient)
  },
  component: AlertsRouteComponent,
})

const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/billing',
  beforeLoad: async ({ context }) => {
    await requireAuth(context.queryClient)
  },
  component: BillingRouteComponent,
})

const statusPagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/status-pages',
  beforeLoad: async ({ context }) => {
    await requireAuth(context.queryClient)
  },
  component: StatusPagesRouteComponent,
})

const monitorDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/monitors/$id',
  beforeLoad: async ({ context }) => {
    await requireAuth(context.queryClient)
  },
  component: MonitorDetailRouteComponent,
})

const incidentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/incidents',
  beforeLoad: async ({ context }) => {
    await requireAuth(context.queryClient)
  },
  component: IncidentsRouteComponent,
})

const incidentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/incidents/$id',
  beforeLoad: async ({ context }) => {
    await requireAuth(context.queryClient)
  },
  component: IncidentDetailRouteComponent,
})

const publicStatusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/status/$slug',
  component: PublicStatusRouteComponent,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  dashboardRoute,
  alertsRoute,
  billingRoute,
  statusPagesRoute,
  monitorDetailRoute,
  incidentsRoute,
  incidentDetailRoute,
  publicStatusRoute,
])

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: 'intent',
  defaultPendingMinMs: 150,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
