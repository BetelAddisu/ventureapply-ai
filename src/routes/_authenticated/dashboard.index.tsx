import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrialStatusBadge } from "@/components/trial-status-badge";
import { FileText, Sparkles, Search, Bot, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

interface DashboardMetrics {
  totalCVs: number;
  matchedJobs: number;
  tailoredCVs: number;
  appliedJobs: number;
}

function DashboardHome() {
  const [name, setName] = useState<string>("");
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalCVs: 0,
    matchedJobs: 0,
    tailoredCVs: 0,
    appliedJobs: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.full_name) setName(profile.full_name);

    // Fetch all metrics in parallel
    const [cvsResult, matchesResult, tailoredResult, applicationsResult] = await Promise.all([
      supabase.from("cvs").select("id", { count: "exact" }).eq("user_id", user.id),
      supabase.from("job_matches").select("id", { count: "exact" }).eq("user_id", user.id),
      supabase.from("cvs").select("title").eq("user_id", user.id).ilike("title", "%tailored%"),
      supabase.from("job_applications").select("id", { count: "exact" }).eq("user_id", user.id),
    ]);

    setMetrics({
      totalCVs: cvsResult.count ?? 0,
      matchedJobs: matchesResult.count ?? 0,
      tailoredCVs: tailoredResult.data?.length ?? 0,
      appliedJobs: applicationsResult.count ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const cards = [
    { to: "/dashboard/cv-builder", icon: FileText, title: "CV Builder", desc: "Craft a beautiful, ATS-ready resume." },
    { to: "/dashboard/tailor", icon: Sparkles, title: "AI Tailor", desc: "Adjust your CV for a specific job." },
    { to: "/dashboard/jobs", icon: Search, title: "Job Tracker", desc: "Live scanner across hundreds of boards." },
    { to: "/dashboard/agent", icon: Bot, title: "Agent Command", desc: "Watch your autonomous agent apply." },
  ];

  const statCards = [
    { label: "Saved CVs", value: metrics.totalCVs },
    { label: "Matched Jobs", value: metrics.matchedJobs },
    { label: "Tailored", value: metrics.tailoredCVs },
    { label: "Auto-Applied", value: metrics.appliedJobs },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Console</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">Welcome back{name ? `, ${name.split(" ")[0]}` : ""}</h1>
          <TrialStatusBadge showUpgradeCta />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? statCards.map((s) => (
              <Card key={s.label} className="glass border-border p-5 animate-pulse">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <div className="mt-2 h-8 w-12 rounded bg-muted" />
              </Card>
            ))
          : statCards.map((s) => (
              <Card key={s.label} className="glass border-border p-5">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-2 text-2xl font-semibold">{s.value}</p>
              </Card>
            ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="group">
            <Card className="glass flex items-center gap-4 border-border p-5 transition hover:border-primary/50 hover:glow">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-br from-primary/30 to-[oklch(0.70_0.20_295)]/30 text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{c.title}</div>
                <div className="text-sm text-muted-foreground">{c.desc}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
