import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Bot, Search, FileText, Zap, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VentureApply — AI CV & Autonomous Job Search" },
      { name: "description", content: "AI-tailored CVs, 24/7 job scanning, and an autonomous agent that applies for you." },
      { property: "og:title", content: "VentureApply" },
      { property: "og:description", content: "AI-tailored CVs, 24/7 job scanning, and an autonomous agent that applies for you." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
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
          <Link to="/auth"><Button size="sm" className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow">Get started</Button></Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <section className="text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            Autonomous job application engine
          </div>
          <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
            Apply to jobs at <span className="text-gradient">machine speed</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            Tailor your CV with AI, scan thousands of jobs 24/7, and let an autonomous agent submit applications while you sleep.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow">
                Start free
              </Button>
            </Link>
            <a href="#features"><Button size="lg" variant="outline">See features</Button></a>
          </div>
        </section>

        <section id="features" className="mt-24 grid gap-5 md:grid-cols-3">
          {[
            { icon: FileText, title: "AI CV Builder", desc: "Live preview, smart sections, ATS-ready output." },
            { icon: Sparkles, title: "AI Tailor Engine", desc: "Micro-adjust your CV for any job description in seconds." },
            { icon: Search, title: "24/7 Job Scanner", desc: "Continuous scraping with Telegram and email alerts." },
            { icon: Bot, title: "Autonomous Agent", desc: "Watch the agent fill, answer and submit forms live." },
            { icon: ShieldCheck, title: "Private & Secure", desc: "End-to-end encrypted, your data stays yours." },
            { icon: Zap, title: "Instant Results", desc: "From profile to first auto-application in minutes." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-[oklch(0.70_0.20_295)]/30 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
