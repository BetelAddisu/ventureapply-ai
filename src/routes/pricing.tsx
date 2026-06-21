import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check, Zap, Sparkles, Bot, Globe, ArrowRight,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — VentureApply AI" },
      { name: "description", content: "Start free. Upgrade when you land the interview." },
    ],
  }),
  component: Pricing,
});

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    icon: Sparkles,
    description: "Perfect for exploring the platform.",
    cta: "Get started free",
    ctaVariant: "outline" as const,
    link: "/auth",
    features: [
      "5 AI CV tailors / month",
      "1 CV stored",
      "AI CV parser",
      "Manual job search",
      "Email notifications",
    ],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    period: "/ month",
    icon: Zap,
    description: "For active job seekers who want an edge.",
    cta: "Start free trial",
    ctaVariant: "default" as const,
    link: "/auth",
    badge: "Most Popular",
    features: [
      "Unlimited AI CV tailors",
      "10 CVs stored",
      "AI CV parser",
      "24/7 Job Scanner",
      "50 auto-applications / month",
      "Telegram & email alerts",
      "Match score analysis",
    ],
    highlight: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "$49",
    period: "/ month",
    icon: Bot,
    description: "For power users and high-volume searchers.",
    cta: "Contact us",
    ctaVariant: "outline" as const,
    link: "/auth",
    features: [
      "Everything in Pro",
      "Unlimited auto-applications",
      "Priority AI queue",
      "WhatsApp alerts",
      "Dedicated support",
      "Early access to new features",
    ],
    highlight: false,
  },
];

const FAQ = [
  {
    q: "When does the free trial end?",
    a: "Your 7-day Pro trial starts the moment you upgrade. No credit card required to start — you only pay if you love it.",
  },
  {
    q: "What counts as an 'auto-application'?",
    a: "Each time the autonomous agent submits an application on your behalf, that's one auto-application. Tailoring a CV manually does not count.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, cancel with one click. You'll keep access until the end of your billing period.",
  },
  {
    q: "Is my CV data secure?",
    a: "All data is encrypted at rest and in transit. We use Supabase with row-level security — no one can access your CVs except you.",
  },
];

function Pricing() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.70_0.20_295)] glow">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">VentureApply</span>
        </Link>
        <nav className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/auth">
            <Button size="sm" className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow">
              Get started
            </Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        {/* Hero */}
        <section className="text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Start free. Upgrade when you<br />
            <span className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] bg-clip-text text-transparent">land the interview.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
            Every tier includes AI-powered CV tools. Upgrade to let the autonomous agent apply while you sleep.
          </p>
        </section>

        {/* Pricing cards */}
        <section className="mt-14 grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            return (
              <div
                key={tier.id}
                className={`glass relative flex flex-col rounded-2xl border p-7 ${
                  tier.highlight
                    ? "border-primary/50 glow shadow-lg"
                    : "border-border"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 px-3 py-1">
                      {tier.badge}
                    </Badge>
                  </div>
                )}

                <div className="mb-5">
                  <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                    tier.highlight
                      ? "bg-gradient-to-br from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground"
                      : "bg-muted text-primary"
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{tier.price}</span>
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  </div>
                  <div className="mt-0.5 font-semibold">{tier.name}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
                </div>

                <ul className="mb-7 flex-1 space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.72_0.18_155)]" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link to={tier.link}>
                  <Button
                    variant={tier.ctaVariant}
                    className={`w-full ${
                      tier.highlight
                        ? "bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow"
                        : ""
                    }`}
                  >
                    {tier.cta} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            );
          })}
        </section>

        {/* Market stats */}
        <section className="mt-20">
          <div className="glass rounded-2xl border border-border p-8 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3 text-primary" />
              Market opportunity
            </div>
            <h2 className="text-2xl font-bold">A $45B+ market, and growing</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              The global online recruitment market is projected to reach $45B+ by 2027. The average job seeker sends
              25+ applications per role. VentureApply reduces that effort by 90%.
            </p>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                { value: "25+", label: "avg applications per job offer", sub: "Source: Glassdoor" },
                { value: "6hrs", label: "average time spent applying per week", sub: "Source: LinkedIn" },
                { value: "90%", label: "reduction in application time with VentureApply", sub: "Based on internal testing" },
              ].map((s) => (
                <div key={s.value}>
                  <div className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] bg-clip-text text-4xl font-bold text-transparent">
                    {s.value}
                  </div>
                  <div className="mt-1 text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-20">
          <h2 className="mb-8 text-center text-2xl font-bold">Common questions</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q} className="glass rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-20 text-center">
          <h2 className="text-3xl font-bold">Ready to apply at machine speed?</h2>
          <p className="mt-3 text-muted-foreground">Join job seekers using VentureApply AI. No credit card required.</p>
          <Link to="/auth">
            <Button
              size="lg"
              className="mt-6 bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow"
            >
              Start for free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
