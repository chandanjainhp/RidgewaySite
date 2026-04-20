import Link from 'next/link';
import { Button, Card } from '@/components/ui';
import NavMobile from '@/components/shared/NavMobile';

export default function LandingPage() {
  const features = [
    {
      title: 'AI Investigation',
      description:
        'The autonomous 6:10 Assistant triages overnight signals, correlates evidence, and proposes likely root causes. Teams wake up with a traceable investigation path instead of a raw alert stream.',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-primary">
          <path
            d="M12 2a4 4 0 0 0-4 4v1.5H7a3 3 0 0 0-3 3V14a3 3 0 0 0 3 3h1V18a4 4 0 0 0 8 0v-1h1a3 3 0 0 0 3-3v-3.5a3 3 0 0 0-3-3h-1V6a4 4 0 0 0-4-4Zm-2 4a2 2 0 0 1 4 0v1.5h-4V6Zm0 11h4V18a2 2 0 0 1-4 0v-1Zm-3-2a1 1 0 0 1-1-1v-3.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H7Z"
            fill="currentColor"
          />
        </svg>
      ),
    },
    {
      title: 'Live Streaming',
      description:
        'SSE-driven updates stream event status, agent reasoning, and evidence changes in real time. Operations can watch incidents evolve without refresh loops or stale dashboards.',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-primary">
          <path
            d="M3 12a9 9 0 0 1 9-9 1 1 0 1 1 0 2 7 7 0 0 0-7 7 1 1 0 1 1-2 0Zm16 0a7 7 0 0 0-7-7 1 1 0 1 1 0-2 9 9 0 0 1 9 9 1 1 0 1 1-2 0ZM7 12a5 5 0 0 1 5-5 1 1 0 1 1 0 2 3 3 0 0 0-3 3 1 1 0 1 1-2 0Zm8 0a3 3 0 0 0-3-3 1 1 0 1 1 0-2 5 5 0 0 1 5 5 1 1 0 1 1-2 0Zm-1 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
            fill="currentColor"
          />
        </svg>
      ),
    },
    {
      title: 'Morning Briefing',
      description:
        'By shift handoff, the system compiles incidents, timelines, and confidence-backed recommendations into one briefing. Maya can approve and publish a final report in minutes.',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-primary">
          <path
            d="M6 3h8.586a2 2 0 0 1 1.414.586l2.414 2.414A2 2 0 0 1 19 7.414V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 2v2a2 2 0 0 0 2 2h2l-4-4Zm-6 8a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H8Zm0 4a1 1 0 0 0 0 2h5a1 1 0 1 0 0-2H8Zm0-8a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H8Z"
            fill="currentColor"
          />
        </svg>
      ),
    },
  ];

  const steps = [
    {
      title: 'Events detected',
      description: 'Sensors, cameras, and telemetry flag overnight anomalies across the site.',
    },
    {
      title: 'Agent investigates',
      description: '6:10 Assistant correlates evidence, runs tools, and drafts causal hypotheses.',
    },
    {
      title: 'Maya reviews',
      description: 'Operations lead validates findings, adjusts narrative, and confirms confidence.',
    },
    {
      title: 'Briefing approved',
      description: 'A final morning report is approved and shared with stakeholders before shift start.',
    },
  ];

  return (
    <div className="min-h-screen bg-surface text-text-primary scroll-smooth">
      <header className="fixed top-0 z-50 w-full border-b border-border/80 bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 md:h-16 lg:px-8 xl:px-10">
          <Link href="/" className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-base font-semibold text-text-primary sm:text-lg">6:10 Assistant</span>
          </Link>

          <div className="hidden items-center gap-2 md:flex lg:gap-4">
            <Link href="/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link href="/register">
              <Button variant="primary">Get Started</Button>
            </Link>
          </div>

          <NavMobile />
        </div>
      </header>

      <main>
        <section className="relative flex min-h-screen items-center overflow-hidden px-4 pb-14 pt-24 sm:px-6 sm:pb-16 sm:pt-28 md:px-8 md:pt-28 lg:px-10 lg:pt-28 xl:px-12">
          <div className="absolute inset-0 bg-linear-to-b from-primary-50/70 to-transparent dark:from-surface-3/30 dark:to-surface" aria-hidden="true" />
          <div className="absolute inset-0 hidden dark:block dark:bg-[radial-gradient(rgba(148,163,184,0.14)_1px,transparent_1px)] dark:bg-size-[20px_20px] dark:opacity-30" aria-hidden="true" />

          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center">
            <span className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold tracking-wide text-primary-700 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-200 sm:text-sm">
              Overnight Intelligence for Industrial Sites
            </span>

            <h1 className="mt-5 text-center text-3xl font-bold leading-tight text-primary sm:mt-6 sm:text-4xl md:text-5xl lg:text-6xl xl:text-6xl">
              Investigations Before Sunrise
              <br className="hidden sm:block" />
              <span className="text-primary dark:text-primary-100">With 6:10 Assistant</span>
            </h1>

            <p className="mx-auto mt-5 max-w-prose text-center text-base text-text-secondary sm:mt-6 sm:text-lg md:text-lg lg:text-xl xl:text-xl">
              6:10 Assistant monitors overnight events, runs autonomous investigations, and prepares a morning-ready operational briefing so your team starts the day with clarity.
            </p>

            <div className="mt-8 flex w-full max-w-md flex-col gap-4 sm:max-w-lg md:max-w-none md:flex-row md:items-center md:justify-center md:gap-4 lg:gap-6">
              <Link href="/register" className="w-full md:w-auto">
                <Button variant="primary" className="w-full md:w-auto">
                  Start Investigating
                </Button>
              </Link>
              <Link href="#features" className="w-full md:w-auto">
                <Button variant="ghost" className="w-full md:w-auto">
                  See How It Works
                </Button>
              </Link>
            </div>

            <Card className="mt-10 w-full max-w-4xl border-surface-4 bg-surface-2 p-4 dark:border-surface-3 dark:bg-surface-4 sm:mt-12 sm:p-6 md:p-6 lg:p-8">
              <div className="rounded-lg border border-surface-3 bg-slate-950 p-4 dark:border-slate-800 sm:p-6 md:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs text-slate-400 sm:text-sm">Live Incident Map</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                  {[...Array(24)].map((_, index) => (
                    <span
                      key={`pin-${index}`}
                      className={`h-2.5 w-2.5 rounded-full ${
                        index % 6 === 0
                          ? 'bg-rose-400'
                          : index % 5 === 0
                            ? 'bg-amber-300'
                            : 'bg-sky-400/70'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 bg-surface-warm px-4 py-14 sm:px-6 sm:py-16 md:px-8 md:py-20 lg:px-10 lg:py-24 xl:px-12">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="mb-6 text-2xl font-bold text-primary sm:text-3xl md:text-4xl lg:text-5xl xl:text-5xl">Platform Capabilities</h2>
              <p className="mt-4 text-text-secondary sm:mt-5 md:text-lg">Purpose-built for overnight intelligence workflows in high-risk industrial environments.</p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:gap-6 md:gap-6 lg:mt-14 lg:grid-cols-3 xl:gap-8">
              {features.map((feature) => (
                <Card key={feature.title} className="bg-surface dark:bg-surface-2">
                  <div className="mb-4 inline-flex rounded-lg bg-primary-50 p-4 dark:bg-primary-900/30">{feature.icon}</div>
                  <h3 className="text-lg font-semibold text-text-primary sm:text-xl">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary sm:text-base">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface px-4 py-14 sm:px-6 sm:py-16 md:px-8 md:py-20 lg:px-10 lg:py-24 xl:px-12">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="mb-6 text-2xl font-bold text-primary sm:text-3xl md:text-4xl lg:text-5xl xl:text-5xl">How It Works</h2>
              <p className="mt-4 text-text-secondary sm:mt-5 md:text-lg">From first signal to approved narrative, every step is auditable and fast.</p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:gap-6 md:gap-6 lg:mt-14 lg:grid-cols-4 xl:gap-8">
              {steps.map((step, index) => (
                <Card key={step.title} className="relative bg-surface-2 dark:bg-surface-3">
                  <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="text-base font-semibold text-text-primary sm:text-lg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface-2 px-4 py-5 sm:px-6 md:px-8 lg:px-10 xl:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} 6:10 Assistant. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-text-primary">
              Login
            </Link>
            <Link href="/register" className="hover:text-text-primary">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
