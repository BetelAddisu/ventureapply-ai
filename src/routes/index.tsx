import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Bot,
  Search,
  FileText,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Minus,
  XCircle,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VentureApply AI — Apply to Jobs at Machine Speed" },
      {
        name: "description",
        content:
          "AI-tailored CVs, 24/7 job scanning, and an autonomous agent that applies for you.",
      },
      { property: "og:title", content: "VentureApply AI" },
      {
        property: "og:description",
        content:
          "AI-tailored CVs, 24/7 job scanning, and an autonomous agent that applies for you.",
      },
    ],
  }),
  component: Index,
});

const FEATURES = [
  {
    icon: FileText,
    title: "AI CV Builder",
    desc: "Live preview, smart sections, ATS-ready output.",
  },
  {
    icon: Sparkles,
    title: "AI Tailor Engine",
    desc: "AI rewrites your CV to mirror any job description in seconds.",
  },
  {
    icon: Search,
    title: "24/7 Job Scanner",
    desc: "Continuous scraping with Telegram and email alerts.",
  },
  {
    icon: Bot,
    title: "Autonomous Agent",
    desc: "Watch the agent fill, answer and submit forms live.",
  },
  {
    icon: ShieldCheck,
    title: "Private & Secure",
    desc: "End-to-end encrypted, your data stays yours.",
  },
  {
    icon: Zap,
    title: "Instant Results",
    desc: "From profile to first auto-application in minutes.",
  },
];

const COMPARISON = [
  { feature: "AI CV Tailoring", va: "full", linkedin: "none", manual: "none" },
  {
    feature: "Autonomous Applications",
    va: "full",
    linkedin: "partial",
    manual: "none",
  },
  {
    feature: "Real-time Alerts",
    va: "full",
    linkedin: "partial",
    manual: "none",
  },
  { feature: "ATS Optimisation", va: "full", linkedin: "none", manual: "none" },
  { feature: "Free to start", va: "full", linkedin: "partial", manual: "full" },
];

const PERSONAS = [
  {
    icon: GraduationCap,
    title: "Recent Graduates",
    desc: "Competing for your first role? AI tailoring helps you stand out without years of experience.",
  },
  {
    icon: RefreshCw,
    title: "Career Switchers",
    desc: "Repositioning your experience for a new industry — without starting your CV from scratch.",
  },
  {
    icon: Zap,
    title: "Active Job Seekers",
    desc: "Applying to 20+ roles a week? Automate the repetitive parts and focus on interviews.",
  },
];

type Mark = "full" | "partial" | "none";

function ComparisonMark({ type }: { type: Mark }) {
  if (type === "full")
    return (
      <CheckCircle2 className="mx-auto h-5 w-5 text-[oklch(0.72_0.18_155)]" />
    );
  if (type === "partial")
    return <Minus className="mx-auto h-5 w-5 text-muted-foreground" />;
  return <XCircle className="mx-auto h-5 w-5 text-destructive/50" />;
}

function Index() {
  return (
    <div className="min-h-screen">
      {/* ── Nav ── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.70_0.20_295)] glow">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            VentureApply
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            to="/pricing"
            className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:block"
          >
            Pricing
          </Link>
          <ThemeToggle />
          <Link to="/auth">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link to="/auth">
            <Button
              size="sm"
              className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow"
            >
              Get started
            </Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        {/* ── Hero ── */}
        <section className="text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            Autonomous job application engine — powered by AI
          </div>
          <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
            Apply to jobs at{" "}
            <span className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] bg-clip-text text-transparent">
              machine speed
            </span>
            .
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            Tailor your CV with AI, scan thousands of jobs 24/7, and let an
            autonomous agent submit applications while you sleep.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/auth">
              <Button
                size="lg"
                className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow"
              >
                Start free
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline">
                See features
              </Button>
            </a>
          </div>
        </section>

        {/* ── Community value prop ── */}
        <div className="mx-auto mt-10 flex max-w-lg items-center justify-center gap-3 rounded-full border border-border bg-card/40 px-5 py-2.5 backdrop-blur">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Built by job seekers, for job seekers — open and community-driven
          </span>
        </div>

        {/* ── Features ── */}
        <section id="features" className="mt-20 grid gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-[oklch(0.70_0.20_295)]/30 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>

        {/* ── Comparison table ── */}
        <section className="mt-20">
          <h2 className="mb-2 text-center text-2xl font-bold">
            Why VentureApply?
          </h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">
            We go far beyond what traditional job boards and manual applications
            offer.
          </p>
          <div className="glass overflow-hidden rounded-2xl border border-border">
            {/* Header */}
            <div className="grid grid-cols-4 border-b border-border bg-card/40 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <div>Feature</div>
              <div className="text-center text-primary">VentureApply AI</div>
              <div className="text-center">LinkedIn Easy Apply</div>
              <div className="text-center">Manual</div>
            </div>
            {COMPARISON.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-4 items-center px-6 py-3.5 text-sm ${i < COMPARISON.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="font-medium">{row.feature}</div>
                <ComparisonMark type={row.va as Mark} />
                <ComparisonMark type={row.linkedin as Mark} />
                <ComparisonMark type={row.manual as Mark} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Personas ── */}
        <section className="mt-20">
          <h2 className="mb-2 text-center text-2xl font-bold">Who it helps</h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">
            Built for every stage of the job search journey.
          </p>
          <div className="grid gap-5 md:grid-cols-3">
            {PERSONAS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="glass rounded-2xl border border-border p-6 text-center"
              >
                <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-[oklch(0.70_0.20_295)]/20 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing CTA ── */}
        <section className="mt-20 text-center">
          <div className="glass inline-block rounded-2xl border border-border px-10 py-10">
            <h2 className="text-2xl font-bold">Simple, transparent pricing</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start free. Upgrade when you're ready to automate.
            </p>
            <Link to="/pricing">
              <Button
                size="lg"
                className="mt-5 bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow"
              >
                See pricing
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
