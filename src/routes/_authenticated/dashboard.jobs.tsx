import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Activity, Mail, MessageCircle, Phone, Search, ExternalLink, Bot,
  Building2, MapPin, Calendar, Sparkles, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

// ─── Server functions ──────────────────────────────────────────────────────────

const listScrapedJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scraped_jobs")
      .select("id, job_title, company, location, url, salary_range, created_at, status")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const listJobMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("job_matches")
      .select(`
        id, match_score, tailor_suggestions, status, created_at,
        scraped_jobs (id, job_title, company, location, url, salary_range)
      `)
      .eq("user_id", context.userId)
      .order("match_score", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const getNotifPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("notify_email, notify_telegram, notify_whatsapp")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      email: data?.notify_email ?? true,
      telegram: data?.notify_telegram ?? false,
      whatsapp: data?.notify_whatsapp ?? false,
    };
  });

const setNotifPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: boolean; telegram: boolean; whatsapp: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ notify_email: data.email, notify_telegram: data.telegram, notify_whatsapp: data.whatsapp })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return data;
  });

// ─── Query options ────────────────────────────────────────────────────────────

const jobsQO = queryOptions({ queryKey: ["scraped-jobs"], queryFn: () => listScrapedJobs() });
const matchesQO = queryOptions({ queryKey: ["job-matches"], queryFn: () => listJobMatches() });
const prefsQO = queryOptions({ queryKey: ["notif-prefs"], queryFn: () => getNotifPrefs() });

export const Route = createFileRoute("/_authenticated/dashboard/jobs")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(jobsQO);
    context.queryClient.ensureQueryData(matchesQO);
    context.queryClient.ensureQueryData(prefsQO);
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  component: Jobs,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  matched: "bg-primary/15 text-primary border-primary/30",
  tailored: "bg-[oklch(0.70_0.20_295)]/15 text-[oklch(0.78_0.18_295)] border-[oklch(0.70_0.20_295)]/30",
  applied_via_agent: "bg-[oklch(0.72_0.18_155)]/15 text-[oklch(0.78_0.16_155)] border-[oklch(0.72_0.18_155)]/30",
  rejected: "bg-destructive/10 text-destructive/80 border-destructive/30",
  new: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  applied_via_agent: "Applied (Agent)",
  matched: "Matched",
  tailored: "Tailored",
  rejected: "Rejected",
  new: "New",
};

function relTime(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80
    ? "text-[oklch(0.72_0.18_155)]"
    : score >= 60
      ? "text-primary"
      : "text-muted-foreground";
  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      <span className={`text-sm font-bold ${color}`}>{score}%</span>
      <Progress value={score} className="h-1 w-12" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function Jobs() {
  const queryClient = useQueryClient();
  const { data: jobs } = useSuspenseQuery(jobsQO);
  const { data: matches } = useSuspenseQuery(matchesQO);
  const { data: prefs } = useSuspenseQuery(prefsQO);

  const setPrefsFn = useServerFn(setNotifPrefs);
  const prefsMutation = useMutation({
    mutationFn: (next: { email: boolean; telegram: boolean; whatsapp: boolean }) =>
      setPrefsFn({ data: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notif-prefs"] });
      toast.success("Notification preferences saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (channel: "email" | "telegram" | "whatsapp") => {
    const next = { ...prefs, [channel]: !prefs[channel] };
    prefsMutation.mutate(next);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Job Tracker & Scanner</h1>
          <p className="text-sm text-muted-foreground">Live matches across hundreds of job boards.</p>
        </div>
        <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
          <Activity className="h-3.5 w-3.5 animate-pulse text-[oklch(0.72_0.18_155)]" />
          Scanning <span className="mx-1 font-semibold text-foreground">4× daily</span>
        </div>
      </div>

      {/* Notification Channels */}
      <Card className="glass border-border p-5">
        <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Notification Channels</p>
        <div className="grid gap-3 md:grid-cols-3">
          <ChannelRow icon={<Mail className="h-4 w-4" />} label="Email" enabled={prefs.email} onChange={() => toggle("email")} saving={prefsMutation.isPending} />
          <ChannelRow icon={<MessageCircle className="h-4 w-4" />} label="Telegram" enabled={prefs.telegram} onChange={() => toggle("telegram")} saving={prefsMutation.isPending} />
          <ChannelRow icon={<Phone className="h-4 w-4" />} label="WhatsApp" enabled={prefs.whatsapp} onChange={() => toggle("whatsapp")} saving={prefsMutation.isPending} />
        </div>
      </Card>

      {/* Tabs: All Jobs | My Matches */}
      <Tabs defaultValue="matches">
        <TabsList>
          <TabsTrigger value="matches">
            <TrendingUp className="mr-2 h-3.5 w-3.5" />
            My Matches
            {(matches as any[]).length > 0 && (
              <Badge className="ml-2 bg-primary/20 text-primary border-0 text-[10px]">
                {(matches as any[]).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">
            <Search className="mr-2 h-3.5 w-3.5" />
            All Scanned Jobs
          </TabsTrigger>
        </TabsList>

        {/* ── Matches tab ── */}
        <TabsContent value="matches">
          <Card className="glass overflow-hidden border-border">
            {(matches as any[]).length === 0 ? (
              <MatchesEmptyState />
            ) : (
              <div className="divide-y divide-border">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_140px_80px_120px_40px] items-center gap-3 bg-card/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <div>Job</div>
                  <div>Company</div>
                  <div className="text-center">Match</div>
                  <div>Status</div>
                  <div />
                </div>
                {(matches as any[]).map((m) => {
                  const job = m.scraped_jobs;
                  return (
                    <div key={m.id} className="grid grid-cols-[1fr_140px_80px_120px_40px] items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                      <div>
                        <div className="text-sm font-medium">{job?.job_title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {job?.location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />{job.location}
                            </span>
                          )}
                          {job?.salary_range && (
                            <span className="text-xs text-[oklch(0.72_0.18_155)]">{job.salary_range}</span>
                          )}
                        </div>
                        {m.tailor_suggestions && (
                          <div className="mt-1 flex items-start gap-1">
                            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{m.tailor_suggestions}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />{job?.company}
                      </div>
                      <ScoreBadge score={m.match_score ?? 0} />
                      <Badge variant="outline" className={`capitalize text-xs ${STATUS_STYLE[m.status ?? "matched"] ?? STATUS_STYLE.matched}`}>
                        {STATUS_LABEL[m.status] ?? m.status}
                      </Badge>
                      <div>
                        {job?.url && (
                          <a href={job.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── All jobs tab ── */}
        <TabsContent value="all">
          <Card className="glass overflow-hidden border-border">
            {(jobs as any[]).length === 0 ? (
              <AllJobsEmptyState />
            ) : (
              <div className="divide-y divide-border">
                <div className="grid grid-cols-[1fr_140px_120px_100px_40px] items-center gap-3 bg-card/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <div>Job Title</div>
                  <div>Company</div>
                  <div>Location</div>
                  <div>Found</div>
                  <div />
                </div>
                {(jobs as any[]).map((j) => (
                  <div key={j.id} className="grid grid-cols-[1fr_140px_120px_100px_40px] items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <div>
                      <div className="text-sm font-medium">{j.job_title}</div>
                      {j.salary_range && <div className="text-xs text-[oklch(0.72_0.18_155)]">{j.salary_range}</div>}
                    </div>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />{j.company}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {j.location ? <><MapPin className="h-3 w-3" />{j.location}</> : "—"}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />{relTime(j.created_at)}
                    </span>
                    {j.url ? (
                      <a href={j.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button>
                      </a>
                    ) : <div />}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatchesEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
        <TrendingUp className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-semibold">No matches yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The agent scans jobs and matches them to your profile. Activate the agent to start generating matches.
        </p>
      </div>
      <Link to="/dashboard/agent">
        <Button className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow">
          <Bot className="mr-2 h-4 w-4" /> Activate Agent
        </Button>
      </Link>
    </div>
  );
}

function AllJobsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-semibold">No jobs scanned yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The scanner runs when the autonomous agent is active. Activate it from the Agent tab.
        </p>
      </div>
      <Link to="/dashboard/agent">
        <Button className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow">
          <Bot className="mr-2 h-4 w-4" /> Go to Agent
        </Button>
      </Link>
    </div>
  );
}

function ChannelRow({
  icon, label, enabled, onChange, saving,
}: {
  icon: React.ReactNode; label: string; enabled: boolean; onChange: () => void; saving: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <Switch checked={enabled} onCheckedChange={onChange} disabled={saving} />
    </div>
  );
}
