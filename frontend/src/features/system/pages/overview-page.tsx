import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BellRing,
  ChartNoAxesCombined,
  CircleCheckBig,
  Globe,
  Layers3,
  ShieldCheck,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Button } from '@/components/ui/button'

const features = [
  {
    icon: ChartNoAxesCombined,
    title: 'Infinite cycle analysis',
    description:
      'Automated checks run in a continuous loop across global nodes with immediate visibility.',
  },
  {
    icon: BellRing,
    title: 'Instant alerts',
    description:
      'Real-time notifications by email, SMS, and webhooks so your team can react in seconds.',
  },
  {
    icon: Layers3,
    title: 'Endless snapshots',
    description:
      'Historical events and trend retention for diagnosing long-term degradations.',
  },
] as const

const pricingPlans = [
  {
    name: 'Foundation',
    displayName: 'Free',
    price: '$0',
    caption: 'For personal projects.',
    features: ['5 monitors', '5 minute intervals'],
    highlighted: false,
    cta: 'Get Started',
  },
  {
    name: 'Professional',
    displayName: 'Pro',
    price: '$29',
    caption: 'For growing teams.',
    features: ['50 monitors', '30 second intervals', 'SMS and integrations'],
    highlighted: true,
    cta: 'Start Free Trial',
  },
  {
    name: 'Enterprise',
    displayName: 'Custom',
    price: 'Sales',
    caption: 'Tailored solutions.',
    features: ['Unlimited monitors', '1 second intervals', '24/7 VIP support'],
    highlighted: false,
    cta: 'Contact Sales',
  },
] as const

export function OverviewPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,#0e0e10,#131315,#0e0e10)] text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-10">
            <Link className="text-xl font-bold tracking-tight text-primary" to="/">
              WEBPULSE
            </Link>
            <div className="hidden items-center gap-8 md:flex">
              <a className="text-sm font-medium text-foreground transition-colors hover:text-primary" href="#stats">
                Metrics
              </a>
              <a className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary" href="#features">
                Features
              </a>
              <a className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary" href="#pricing">
                Pricing
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            <Link className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block" to="/login">
              Log in
            </Link>
            <Link to="/register">
              <Button className="rounded-sm px-5 text-sm font-medium">Start Now</Button>
            </Link>
          </div>
        </nav>
      </header>

      <main className="overflow-hidden">
        <section className="relative flex min-h-screen items-center justify-center px-6 pt-24">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(78,222,163,0.14),transparent_32%)]" />
          <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(var(--color-primary)_1px,transparent_1px)] [background-size:28px_28px]" />

          <div className="relative z-10 mx-auto max-w-4xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-sm border border-white/10 bg-background/40 px-4 py-1.5 backdrop-blur-sm">
              <span className="size-1.5 animate-pulse rounded-sm bg-primary" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                Endless monitoring
              </span>
            </div>

            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-foreground md:text-8xl">
              Perpetual <span className="text-primary">uptime</span> for your stack.
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg font-light leading-relaxed text-muted-foreground md:text-xl">
              Continuous monitoring that never sleeps. Detect, analyze, and resolve incidents before your users notice the difference.
            </p>

            <div className="mt-12 flex flex-col items-center justify-center gap-6 sm:flex-row">
              <Link to="/register">
                <Button className="h-14 rounded-sm px-10 text-base shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]">
                  Start 14-Day Free Trial
                </Button>
              </Link>
              <Link className="group inline-flex items-center gap-2 font-medium text-foreground transition-colors hover:text-primary" to="/login">
                <span className="underline underline-offset-8">See live demo</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-28" id="stats">
          <div className="grid grid-cols-1 gap-12 text-center md:grid-cols-3">
            <StatBlock label="Average availability" value="99.99%" />
            <StatBlock label="Global latency" value="185ms" />
            <StatBlock label="Active coverage" value="24/7" />
          </div>

          <div className="mt-20 rounded-sm border border-white/5 bg-card/30 p-8 backdrop-blur-sm">
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <h3 className="text-2xl font-semibold text-foreground">Complete flow visibility</h3>
                <p className="mt-2 text-muted-foreground">
                  Our analysis engine processes monitoring events continuously to keep every service signal visible at all times.
                </p>
              </div>
              <div className="flex-1">
                <div className="h-1 overflow-hidden rounded-sm bg-white/5">
                  <div className="h-full w-2/3 rounded-sm bg-primary shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-28" id="features">
          <div className="mb-20 max-w-2xl">
            <h2 className="text-4xl font-bold tracking-tight text-foreground">
              Engineering for continuity
            </h2>
            <p className="mt-6 text-lg font-light text-muted-foreground">
              We design tools that fit your workflow without friction, using the same polished WebPulse visual language.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon

              return (
                <article className="rounded-sm border border-white/5 bg-card px-8 py-9 transition duration-500 hover:border-primary/20 hover:bg-accent/40" key={feature.title}>
                  <div className="mb-6 flex size-12 items-center justify-center rounded-sm bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{feature.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{feature.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-28" id="pricing">
          <div className="mb-20 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-foreground">Plans for every scale</h2>
            <p className="mt-4 font-light text-muted-foreground">
              Seamless scalability from startups to global enterprises.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <article
                className={
                  plan.highlighted
                    ? 'relative flex flex-col rounded-sm border-2 border-primary bg-accent p-10 shadow-[0_0_50px_-20px_rgba(78,222,163,0.3)]'
                    : 'flex flex-col rounded-sm border border-white/5 bg-card p-10 transition-colors hover:bg-accent/35'
                }
                key={plan.name}
              >
                {plan.highlighted ? (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-sm bg-primary px-4 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-primary-foreground">
                    Most popular
                  </div>
                ) : null}
                <span className={plan.highlighted ? 'font-mono text-[10px] uppercase tracking-[0.24em] text-primary' : 'font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground'}>
                  {plan.name}
                </span>
                <h3 className="mt-4 text-2xl font-bold text-foreground">{plan.displayName}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{plan.caption}</p>
                <div className="mt-8 text-4xl font-bold text-foreground">
                  {plan.price}
                  {plan.price.startsWith('$') ? <span className="text-sm font-normal text-muted-foreground">/mes</span> : null}
                </div>
                <ul className="mt-8 flex flex-1 flex-col gap-4">
                  {plan.features.map((feature) => (
                    <li className="flex items-center gap-3 text-sm text-muted-foreground" key={feature}>
                      <CircleCheckBig className="size-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className={
                    plan.highlighted
                      ? 'mt-10 h-12 rounded-sm'
                      : 'mt-10 h-12 rounded-sm border border-white/10 bg-transparent text-foreground hover:bg-white/5'
                  }
                  variant={plan.highlighted ? 'default' : 'ghost'}
                >
                  {plan.cta}
                </Button>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-gradient-to-t from-primary/5 to-transparent px-6 py-36 text-center">
          <h2 className="text-5xl font-bold tracking-tight text-foreground md:text-7xl">
            Keep the pulse
            <br />
            of your success.
          </h2>
          <Link to="/register">
            <button className="mt-10 rounded-sm bg-white px-12 py-6 text-lg font-bold text-black transition-transform hover:scale-105 active:scale-95">
              Start Now
            </button>
          </Link>
          <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            No credit card required • Setup in 1 minute
          </p>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-card px-6 py-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 md:grid-cols-4 md:gap-8">
          <div>
            <span className="mb-6 block text-2xl font-bold tracking-tight text-primary">
              WEBPULSE
            </span>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Redefining infrastructure monitoring with surgical precision and absolute availability.
            </p>
            <div className="flex gap-4">
              <SocialCircle>
                <Globe className="size-4" />
              </SocialCircle>
              <SocialCircle>
                <ShieldCheck className="size-4" />
              </SocialCircle>
            </div>
          </div>

          <FooterColumn items={['Status Pages', 'API Monitoring', 'Synthetics', 'Integrations']} title="Product" />
          <FooterColumn items={['Documentation', 'Technical Blog', 'Uptime Report', 'Community']} title="Resources" />
          <FooterColumn items={['About Us', 'Privacy', 'Terms', 'Support']} title="Company" />
        </div>

        <div className="mx-auto mt-20 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            © 2024 WebPulse Inc. All rights reserved.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Systems: Operating in 48 regions
          </p>
        </div>
      </footer>
    </div>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-6xl font-bold tracking-tighter text-foreground">{value}</span>
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

function FooterColumn({
  items,
  title,
}: {
  items: readonly string[]
  title: string
}) {
  return (
    <div>
      <h5 className="mb-6 text-sm font-bold uppercase tracking-[0.24em] text-foreground">
        {title}
      </h5>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item}>
            <a className="text-sm font-light text-muted-foreground transition-colors hover:text-primary" href="#">
              {item}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SocialCircle({ children }: { children: ReactNode }) {
  return (
    <a className="flex size-10 items-center justify-center rounded-sm border border-white/10 transition-colors hover:border-primary/50" href="#">
      {children}
    </a>
  )
}
