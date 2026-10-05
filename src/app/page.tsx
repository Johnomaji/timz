"use client";

import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Lock,
  ShieldCheck,
  Timer,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CurrencySwitcher } from "@/components/shell";
import { Badge, Button, Card, ThemeToggle } from "@/components/ui";
import { useMoney, useStore } from "@/lib/store";
import { cn, pctRange } from "@/lib/utils";

const accentRing = {
  brand: "hover:border-brand/50",
  violet: "hover:border-violet/50",
  cyan: "hover:border-cyan/50",
  warn: "hover:border-warn/50",
} as const;

const accentText = {
  brand: "text-brand",
  violet: "text-violet",
  cyan: "text-cyan",
  warn: "text-warn",
} as const;

const FEATURES = [
  {
    icon: Zap,
    title: "A target rate, set on day one",
    body: "Every plan quotes a range, and your subscription is assigned a target rate inside it. Watch ROI accrue on your dashboard and collect principal plus profit at maturity.",
  },
  {
    icon: ShieldCheck,
    title: "Every transfer reviewed",
    body: "Deposits and withdrawals pass through an admin approval queue before funds move, so nothing settles unnoticed.",
  },
  {
    icon: BarChart3,
    title: "Transparent ledger",
    body: "Deposits, withdrawals, earnings, referrals and admin adjustments are all recorded in one filterable transaction history.",
  },
  {
    icon: Lock,
    title: "Custody you can audit",
    body: "Segregated wallets per asset with published addresses, plus optional two-factor authentication on every account.",
  },
];

const STEPS = [
  {
    title: "Create your account",
    body: "Sign up in under a minute. Identity verification takes two minutes and you can do it whenever you like.",
  },
  {
    title: "Fund your balance",
    body: "Send USDT, BTC or ETH to your assigned wallet. Our desk confirms the deposit and credits you.",
  },
  {
    title: "Subscribe to a plan",
    body: "Choose the term and yield that fits your horizon, then allocate any amount within the plan range.",
  },
  {
    title: "Collect at maturity",
    body: "Your principal and accumulated ROI land back in your available balance, ready to withdraw or reinvest.",
  },
];

const FAQS = [
  {
    q: "What does the platform invest in?",
    a: "We diversify across real-world assets and financial markets, including established businesses, real estate and landed properties, equities, commodities, forex, and emerging digital opportunities such as Web3.",
  },
  {
    q: "Why diversify across different sectors?",
    a: "Different investments perform differently over time. By combining businesses, property, traditional markets, and digital opportunities, we aim to build a more resilient portfolio and reduce dependence on a single market.",
  },
  {
    q: "How are returns generated?",
    a: "Returns can come from business growth, property appreciation and income, dividends, interest, trading opportunities, and market movements. Our strategies are designed with a long-term focus rather than relying on a single trade or market.",
  },
  {
    q: "What makes the strategy sustainable?",
    a: "We focus on assets and strategies with the potential to create value over time. Capital is allocated across different opportunities while risk and market conditions are continuously monitored.",
  },
  {
    q: "Are returns guaranteed?",
    a: "No investment can honestly guarantee a return. Our objective is to pursue consistent, sustainable returns while managing risk and protecting capital.",
  },
  {
    q: "How do I get started?",
    a: "Create an account, complete verification, choose an available investment plan, and fund your account through the approved payment method.",
  },
];

export default function LandingPage() {
  const { db, currentUser } = useStore();
  const money = useMoney();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const activePlans = db.plans.filter((p) => p.active);
  const totalUnderManagement = db.investments
    .filter((i) => i.status === "active")
    .reduce((sum, i) => sum + i.amount, 0);
  const dashboardHref = currentUser?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-base/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <span className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-cyan text-brand-ink">
              <Wallet className="size-4" strokeWidth={2.5} />
            </span>
            <span className="text-lg font-semibold tracking-tight">{db.settings.platformName}</span>
          </span>

          <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#plans" className="transition-colors hover:text-ink">
              Plans
            </a>
            <a href="#how" className="transition-colors hover:text-ink">
              How it works
            </a>
            <a href="#faq" className="transition-colors hover:text-ink">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:flex" />
            <CurrencySwitcher />
            {currentUser ? (
              <Link href={dashboardHref}>
                <Button size="sm">
                  Go to dashboard
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Open account</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="glow-grid relative overflow-hidden border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <div className="animate-rise max-w-3xl">
            <Badge tone="success" className="mb-6">
              <span className="size-1.5 animate-ring rounded-full bg-brand" />
              Live yield desk · {activePlans.length} active plans
            </Badge>

            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight sm:text-6xl">
              Put your digital assets{" "}
              <span className="text-gradient">to work every single day.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
              {db.settings.platformName} is a managed yield platform. Fund your balance, pick a plan
              that matches your horizon, and track ROI, withdrawals and referrals from one clean
              dashboard.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href={currentUser ? dashboardHref : "/register"}>
                <Button size="lg">
                  {currentUser ? "Go to dashboard" : "Start investing"}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href="#plans">
                <Button size="lg" variant="outline">
                  Compare plans
                </Button>
              </a>
            </div>

            <div className="mt-12 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                { label: "Under management", value: money(totalUnderManagement, { compact: true }) },
                { label: "Investors", value: `${db.users.filter((u) => u.role === "user").length}` },
                {
                  label: "Top annual ROI",
                  value: `${Math.max(...activePlans.map((p) => p.roiMaxPct))}%`,
                },
                { label: "Payout uptime", value: "99.9%" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-mono text-2xl font-semibold text-ink">{stat.value}</p>
                  <p className="mt-1 text-xs text-faint">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="plans" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Three plans. One dashboard.
            </h2>
            <p className="mt-3 text-muted">
              Pick a term and your target rate is set for its full length. Principal and ROI are
              paid together at maturity — no lock-in beyond the term you pick.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activePlans.map((plan) => {
              const featured = plan.id === "plan_6m";
              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "flex flex-col p-6 transition-colors",
                    accentRing[plan.accent],
                    featured && "border-brand/40 bg-surface",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-ink">{plan.name}</h3>
                    {featured && <Badge tone="success">Popular</Badge>}
                  </div>
                  <p className="mt-1.5 min-h-10 text-sm text-muted">{plan.tagline}</p>

                  <div className="mt-5 flex items-end gap-1.5">
                    <span className={cn("font-mono text-4xl font-semibold", accentText[plan.accent])}>
                      {pctRange(plan.roiMinPct, plan.roiMaxPct)}
                    </span>
                    <span className="pb-1 text-sm text-muted">total ROI</span>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                    <Row label="Term" value={`${plan.durationDays} days`} />
                    <Row
                      label="Range"
                      value={`${money(plan.minAmount, { compact: true })} – ${money(plan.maxAmount, { compact: true })}`}
                    />
                  </div>

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex gap-2 text-sm text-muted">
                        <Check className={cn("mt-0.5 size-4 shrink-0", accentText[plan.accent])} />
                        {perk}
                      </li>
                    ))}
                  </ul>

                  <Link href={currentUser ? "/dashboard/plans" : "/register"} className="mt-6">
                    <Button variant={featured ? "primary" : "outline"} className="w-full">
                      Choose {plan.name}
                    </Button>
                  </Link>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-surface/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Built like infrastructure, not a spreadsheet.
              </h2>
              <p className="mt-3 text-muted">
                Both sides of the platform are first-class: investors get a live portfolio view, and
                administrators get approval queues and full control over plans and platform limits.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Badge tone="info">
                  <TrendingUp className="size-3" />
                  Live ROI accrual
                </Badge>
                <Badge tone="violet">
                  <ShieldCheck className="size-3" />
                  Admin approval queues
                </Badge>
                <Badge tone="warning">
                  <Timer className="size-3" />
                  Maturity tracking
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <Card key={feature.title} className="p-5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-brand/12 text-brand">
                    <feature.icon className="size-4.5" />
                  </span>
                  <h3 className="mt-4 font-medium text-ink">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            From signup to payout in four steps.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <Card key={step.title} className="relative p-6">
                <span className="font-mono text-sm text-brand">0{i + 1}</span>
                <h3 className="mt-3 font-medium text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-b border-line bg-surface/30">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Questions, answered.</h2>
          <div className="mt-8 divide-y divide-line overflow-hidden rounded-xl2 border border-line bg-surface">
            {FAQS.map((faq, i) => (
              <div key={faq.q}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2/50"
                  aria-expanded={openFaq === i}
                >
                  <span className="font-medium text-ink">{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted transition-transform",
                      openFaq === i && "rotate-180",
                    )}
                  />
                </button>
                {openFaq === i && (
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{faq.a}</p>
                )}
              </div>
            ))}
          </div>

          <figure className="mt-10 border-l-2 border-brand/60 pl-5">
            <blockquote className="text-lg leading-relaxed text-ink">
              Diversify. Invest in real value. Manage risk. Compound for the long term.
            </blockquote>
            <figcaption className="mt-2 text-xs tracking-wide text-faint uppercase">
              Our philosophy
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="glow-grid border-b border-line">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Open an account in a minute.
          </h2>
          <p className="mt-3 text-muted">
            No card required. This is a demo environment — explore both the investor and admin sides
            with the seeded credentials.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register">
              <Button size="lg">
                Create free account
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Use demo login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-faint">
          <span className="flex items-center gap-2">
            <Wallet className="size-4" />
            {db.settings.platformName} · demo build
          </span>
          <span>Mock data only. Not financial advice, and not a real investment product.</span>
        </div>
      </footer>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className={cn("font-mono", accent ? "font-semibold text-brand" : "text-ink")}>
        {value}
      </span>
    </div>
  );
}
