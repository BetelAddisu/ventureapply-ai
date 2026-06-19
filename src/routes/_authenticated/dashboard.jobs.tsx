import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Activity, Mail, MessageCircle, Phone, Search, ExternalLink, Bot,
  Building2, MapPin, Calendar, Sparkles, TrendingUp, Link2, Loader2,
  Send, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { scrapeJob, autoApply } from "@/lib/jobs.functions";

// ─── Server functions ──────────────────────────────────────────────────────────

const listScrapedJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scraped_jobs")
      // Real column names from schema: job_title, job_description (not title/description)
      .select("id, job_title, company, url, salary_range, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ScrapedJob[];
  });

const listJobMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("job_matches")
      .select(`
        id, match_score, tailor_suggestions, status, created_at,
        scraped_jobs ( id, job_title, company, url, salary_range )
      `)
      .eq("user_id", context.userId)
      .order("match_score", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as JobMatch[];
  });

const listUserCVs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("cvs")
      .select("id, title")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    return (data ?? []) as CVOption[];
  });

// Profiles uses a single `notification_preference` text column, not separate booleans.
// We store email/telegram/whatsapp as a comma-separated string.
const getNotifPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("notification_preference")
      .eq("id", context.userId)
      .maybeSingle();
    const pref = data?.notification_preference ?? "email";
    return {
      email:    pref.includes("email"),
      telegram: pref.includes("telegram"),
      whatsapp: pref.includes("whatsapp"),
    };
  });

const setNotifPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: boolean; telegram: boolean; whatsapp: boolean }) => d)
  .handler(async ({ data, context }) => {
    const channels: string[] = [];
    if (data.email)    channels.push("email");
    if (data.telegram) channels.push("telegram");
    if (data.whatsapp) channels.push("whatsapp");
    const { error } = await context.supabase
      .from("profiles")
      .update({ notification_preference: channels.join(",") })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return data;
  });

// ─── Query options ─────────────────────────────────────────────────────────────

const jobsQO    = queryOptions({ queryKey: ["scraped-jobs"],  queryFn: () => listScrapedJobs() });
const matchesQO = queryOptions({ queryKey: ["job-matches"],   queryFn: () => listJobMatches() });
const cvsQO     = queryOptions({ queryKey: ["user-cvs"],      queryFn: () => listUserCVs() });
const prefsQO   = queryOptions({ queryKey: ["notif-prefs"],   queryFn: () => getNotifPrefs() });

export const Route = createFileRoute("/_authenticated/dashboard/jobs")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(jobsQO);
    context.queryClient.ensureQueryData(matchesQO);
    context.queryClient.ensureQueryData(cvsQO);
    context.queryClient.ensureQueryData(prefsQO);
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  component: Jobs,
});

// ─── Types (matching real schema column names) ─────────────────────────────────

type ScrapedJob = {
  id: string;
  job_title: string;       // real column: job_title
  company: string;
  url: string | null;
  salary_range: string | null;
  created_at: string;
};

type JobMatch = {
  id: string;
  match_score: number | null;
  tailor_suggestions: string | null;
  status: string;
  created_at: string;
  scraped_jobs: {
    id: string;
    job_title: string;    // real column: job_title
    company: string;
    url: string | null;
    salary_range: string | null;
  } | null;
};

type CVOption = { id: string; title: string };

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  matched:           "bg-primary/15 text-primary border-primary/30",
  tailored:          "bg-[oklch(0.70_0.20_295)]/15 text-[oklch(0.78_0.18_295)] border-[oklch(0.70_0.20_295)]/30",
  applied_via_agent: "bg-[oklch(0.72_0.18_155)]/15 text-[oklch(0.78_0.16_155)] border-[oklch(0.72_0.18_155)]/30",
  applied:           "bg-[oklch(0.72_0.18_155)]/15 text-[oklch(0.78_0.16_155)] border-[oklch(0.72_0.18_155)]/30",
  rejected:          "bg-destructive/10 text-destructive/80 border-destructive/30",
  new:               "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  applied_via_agent: "Applied (Agent)",
  applied:           "Applied",
  matched:           "Matched",
  tailored:          "Tailored",
  rejected:          "Rejected",
  new:               "New",
};

function relTime(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-[oklch(0.72_0.18_155)]" : score >= 60 ? "text-primary" : "text-muted-foreground";
  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      <span className={`text-sm font-bold ${color}`}>{score}%</span>
      <Progress value={score} className="h-1 w-12" />
    </div>
  );
}

// ─── Scrape Job Modal ──────────────────────────────────────────────────────────

function ScrapeModal({
  open, onClose, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const scrapeJobFn = useServerFn(scrapeJob);

  const handleScrape = async () => {
    if (!url.trim()) return toast.error("Enter a URL first");
    setScraping(true);
    try {
      const result = await scrapeJobFn({ data: { url: url.trim() } });
      toast.success(`Scraped: "${result.title}"`);
      setUrl("");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Scraping failed");
    } finally {
      setScraping(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Scrape a Job Posting
          </DialogTitle>
          <DialogDescription>
            Paste any public job URL — the agent will fetch and extract the job description for you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !scraping && handleScrape()}
              placeholder="https://jobs.lever.co/company/job-id"
              disabled={scraping}
              className="flex-1"
            />
            <Button
              onClick={handleScrape}
              disabled={scraping || !url.trim()}
              className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 shrink-0"
            >
              {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {scraping && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Fetching and parsing page content…
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Works with most public job boards: LinkedIn, Lever, Greenhouse, Workday, and direct company pages.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Auto-Apply Button ─────────────────────────────────────────────────────────

function AutoApplyButton({
  jobId, matchId, cvs, currentStatus, onApplied,
}: {
  jobId: string;
  matchId: string;
  cvs: CVOption[];
  currentStatus: string;
  onApplied: (matchId: string) => void;
}) {
  const [applying, setApplying] = useState(false);
  const autoApplyFn = useServerFn(autoApply);

  const alreadyApplied = currentStatus === "applied" || currentStatus === "applied_via_agent";

  const handleApply = async () => {
    if (alreadyApplied) return;
    const cvId = cvs[0]?.id;
    if (!cvId) {
      toast.error("No CV found — build one in the CV Builder first.");
      return;
    }
    setApplying(true);
    toast.info("Agent is processing your application…", { duration: 3500 });
    try {
      await autoApplyFn({ data: { cv_id: cvId, job_id: jobId } });
      toast.success("Application submitted!");
      onApplied(matchId);
    } catch (e: any) {
      toast.error(e.message ?? "Auto-apply failed");
    } finally {
      setApplying(false);
    }
  };

  if (alreadyApplied) {
    return (
      <Badge variant="outline" className={STATUS_STYLE.applied}>
        <CheckCircle2 className="mr-1 h-3 w-3" /> Applied
      </Badge>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleApply}
      disabled={applying}
      className="border-primary/40 text-primary hover:bg-primary/10 text-xs"
    >
      {applying
        ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Applying…</>
        : <><Send className="mr-1.5 h-3 w-3" />Auto-Apply</>}
    </Button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

function Jobs() {
  const queryClient = useQueryClient();
  const { data: jobs }    = useSuspenseQuery(jobsQO);
  const { data: matches } = useSuspenseQuery(matchesQO);
  const { data: cvs }     = useSuspenseQuery(cvsQO);
  const { data: prefs }   = useSuspenseQuery(prefsQO);

  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [appliedMatchIds, setAppliedMatchIds] = useState<Set<string>>(new Set());

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

  const toggle = (channel: "email" | "telegram" | "whatsapp") =>
    prefsMutation.mutate({ ...prefs, [channel]: !prefs[channel] });

  const handleScrapeSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["scraped-jobs"] });
  };

  const handleApplied = (matchId: string) => {
    setAppliedMatchIds((prev) => new Set([...prev, matchId]));
  };

  return (
    <>
      <ScrapeModal
        open={scrapeOpen}
        onClose={() => setScrapeOpen(false)}
        onSuccess={handleScrapeSuccess}
      />

      <div className="mx-auto max-w-6xl space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Job Tracker &amp; Scanner</h1>
            <p className="text-sm text-muted-foreground">Live matches across hundreds of job boards.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setScrapeOpen(true)}
              variant="outline"
              size="sm"
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              <Link2 className="mr-1.5 h-4 w-4" />
              Scrape Job URL
            </Button>
            <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
              <Activity className="h-3.5 w-3.5 animate-pulse text-[oklch(0.72_0.18_155)]" />
              Scanning <span className="mx-1 font-semibold text-foreground">4× daily</span>
            </div>
          </div>
        </div>

        {/* Notification Channels */}
        <Card className="glass border-border p-5">
          <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Notification Channels</p>
          <div className="grid gap-3 md:grid-cols-3">
            <ChannelRow icon={<Mail className="h-4 w-4" />}          label="Email"    enabled={prefs.email}    onChange={() => toggle("email")}    saving={prefsMutation.isPending} />
            <ChannelRow icon={<MessageCircle className="h-4 w-4" />} label="Telegram" enabled={prefs.telegram} onChange={() => toggle("telegram")} saving={prefsMutation.isPending} />
            <ChannelRow icon={<Phone className="h-4 w-4" />}         label="WhatsApp" enabled={prefs.whatsapp} onChange={() => toggle("whatsapp")} saving={prefsMutation.isPending} />
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="matches">
          <TabsList>
            <TabsTrigger value="matches">
              <TrendingUp className="mr-2 h-3.5 w-3.5" /> My Matches
              {(matches as JobMatch[]).length > 0 && (
                <Badge className="ml-2 bg-primary/20 text-primary border-0 text-[10px]">
                  {(matches as JobMatch[]).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">
              <Search className="mr-2 h-3.5 w-3.5" /> All Scanned Jobs
            </TabsTrigger>
          </TabsList>

          {/* My Matches */}
          <TabsContent value="matches">
            <Card className="glass overflow-hidden border-border">
              {(matches as JobMatch[]).length === 0 ? (
                <EmptyState
                  icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />}
                  title="No matches yet"
                  desc="The agent scans jobs and matches them to your profile. Activate the agent to start."
                />
              ) : (
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-[1fr_140px_80px_120px_120px_40px] bg-card/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <div>Job</div><div>Company</div><div className="text-center">Match</div><div>Status</div><div>Action</div><div />
                  </div>
                  {(matches as JobMatch[]).map((m) => {
                    const job = m.scraped_jobs;
                    const isApplied = appliedMatchIds.has(m.id);
                    const effectiveStatus = isApplied ? "applied" : m.status;
                    return (
                      <div key={m.id} className="grid grid-cols-[1fr_140px_80px_120px_120px_40px] items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                        <div>
                          <div className="text-sm font-medium">{job?.job_title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {job?.salary_range && <span className="text-xs text-[oklch(0.72_0.18_155)]">{job.salary_range}</span>}
                          </div>
                          {m.tailor_suggestions && (
                            <div className="mt-1 flex items-start gap-1">
                              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                              <p className="text-[11px] text-muted-foreground line-clamp-1">{m.tailor_suggestions}</p>
                            </div>
                          )}
                        </div>
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />{job?.company}
                        </span>
                        <ScoreBadge score={m.match_score ?? 0} />
                        <Badge variant="outline" className={`capitalize text-xs ${STATUS_STYLE[effectiveStatus] ?? STATUS_STYLE.matched}`}>
                          {STATUS_LABEL[effectiveStatus] ?? effectiveStatus}
                        </Badge>
                        <AutoApplyButton
                          jobId={job?.id ?? m.id}
                          matchId={m.id}
                          cvs={cvs as CVOption[]}
                          currentStatus={effectiveStatus}
                          onApplied={handleApplied}
                        />
                        {job?.url
                          ? <a href={job.url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button></a>
                          : <div />}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* All Jobs */}
          <TabsContent value="all">
            <Card className="glass overflow-hidden border-border">
              {(jobs as ScrapedJob[]).length === 0 ? (
                <EmptyState
                  icon={<Search className="h-8 w-8 text-muted-foreground" />}
                  title="No jobs scanned yet"
                  desc="The scanner runs when the autonomous agent is active, or use the Scrape Job URL button above to add one manually."
                />
              ) : (
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-[1fr_140px_100px_40px] bg-card/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <div>Job Title</div><div>Company</div><div>Found</div><div />
                  </div>
                  {(jobs as ScrapedJob[]).map((j) => (
                    <div key={j.id} className="grid grid-cols-[1fr_140px_100px_40px] items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                      <div>
                        <div className="text-sm font-medium">{j.job_title}</div>
                        {j.salary_range && <div className="text-xs text-[oklch(0.72_0.18_155)]">{j.salary_range}</div>}
                      </div>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Building2 className="h-3.5 w-3.5 shrink-0" />{j.company}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{relTime(j.created_at)}</span>
                      {j.url
                        ? <a href={j.url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button></a>
                        : <div />}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">{icon}</div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{desc}</p>
      </div>
      <Link to="/dashboard/agent">
        <Button className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow">
          <Bot className="mr-2 h-4 w-4" /> Go to Agent
        </Button>
      </Link>
    </div>
  );
}

function ChannelRow({ icon, label, enabled, onChange, saving }: {
  icon: React.ReactNode; label: string; enabled: boolean; onChange: () => void; saving: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-center gap-2"><span className="text-primary">{icon}</span><span className="text-sm">{label}</span></div>
      <Switch checked={enabled} onCheckedChange={onChange} disabled={saving} />
    </div>
  );
}
