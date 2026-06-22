import { createFileRoute, Link } from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Activity,
  Mail,
  MessageCircle,
  Phone,
  Search,
  ExternalLink,
  Bot,
  Building2,
  MapPin,
  Calendar,
  Sparkles,
  TrendingUp,
  Link2,
  Loader2,
  Send,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { scrapeJob, autoApply, fetchJobs, logUserSearch, getUserSearchHistory } from "@/lib/jobs.functions";
import { matchJobsToCV } from "@/lib/match.functions";

// ─── Server functions ──────────────────────────────────────────────────────────

const listScrapedJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scraped_jobs")
      .select("id, job_title, company, url, salary_range, location, created_at, search_query, source, searched_by_user_id")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ScrapedJob[];
  });

const listMyScannedJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    console.log(`[listMyScannedJobs] Fetching jobs for user ${context.userId}`);
    const { data, error } = await context.supabase
      .from("scraped_jobs")
      .select("id, job_title, company, url, salary_range, location, created_at, search_query, source, searched_by_user_id")
      .eq("searched_by_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[listMyScannedJobs] Error:", error.message);
      throw new Error(error.message);
    }
    console.log(`[listMyScannedJobs] Found ${data?.length ?? 0} jobs for user ${context.userId}`);
    return (data ?? []) as unknown as ScrapedJob[];
  });

const listJobMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("job_matches")
      .select(
        `
        id, match_score, tailor_suggestions, status, created_at,
        scraped_jobs ( id, job_title, company, url, salary_range )
      `,
      )
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
      email: pref.includes("email"),
      telegram: pref.includes("telegram"),
      whatsapp: pref.includes("whatsapp"),
    };
  });

const setNotifPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { email: boolean; telegram: boolean; whatsapp: boolean }) => d,
  )
  .handler(async ({ data, context }) => {
    const channels: string[] = [];
    if (data.email) channels.push("email");
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

const jobsQO = queryOptions({
  queryKey: ["scraped-jobs"],
  queryFn: () => listScrapedJobs(),
});
const myJobsQO = queryOptions({
  queryKey: ["my-scanned-jobs"],
  queryFn: () => listMyScannedJobs(),
});
const matchesQO = queryOptions({
  queryKey: ["job-matches"],
  queryFn: () => listJobMatches(),
});
const cvsQO = queryOptions({
  queryKey: ["user-cvs"],
  queryFn: () => listUserCVs(),
});
const prefsQO = queryOptions({
  queryKey: ["notif-prefs"],
  queryFn: () => getNotifPrefs(),
});

const searchHistoryQO = queryOptions({
  queryKey: ["search-history"],
  queryFn: () => getUserSearchHistory(),
});

export const Route = createFileRoute("/_authenticated/dashboard/jobs")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(jobsQO);
    context.queryClient.ensureQueryData(myJobsQO);
    context.queryClient.ensureQueryData(matchesQO);
    context.queryClient.ensureQueryData(cvsQO);
    context.queryClient.ensureQueryData(prefsQO);
    context.queryClient.ensureQueryData(searchHistoryQO);
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  component: Jobs,
});

// ─── Types ──────────────────────────────────────────────────────────────────────

type ScrapedJob = {
  id: string;
  job_title: string;
  company: string;
  url: string | null;
  salary_range: string | null;
  location: string | null;
  created_at: string;
  search_query: string | null;
  source: string | null;
  searched_by_user_id: string | null;
};

type JobMatch = {
  id: string;
  match_score: number | null;
  tailor_suggestions: string | null;
  status: string;
  created_at: string;
  scraped_jobs: {
    id: string;
    job_title: string;
    company: string;
    url: string | null;
    salary_range: string | null;
  } | null;
};

type CVOption = { id: string; title: string };
type LocationType = "any" | "remote" | "hybrid" | "onsite";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  matched: "bg-primary/15 text-primary border-primary/30",
  tailored: "bg-[oklch(0.70_0.20_295)]/15 text-[oklch(0.78_0.18_295)] border-[oklch(0.70_0.20_295)]/30",
  applied_via_agent: "bg-[oklch(0.72_0.18_155)]/15 text-[oklch(0.78_0.16_155)] border-[oklch(0.72_0.18_155)]/30",
  applied: "bg-[oklch(0.72_0.18_155)]/15 text-[oklch(0.78_0.16_155)] border-[oklch(0.72_0.18_155)]/30",
  rejected: "bg-destructive/10 text-destructive/80 border-destructive/30",
  new: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  applied_via_agent: "Applied (Agent)",
  applied: "Applied",
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
  const color =
    score >= 80 ? "text-[oklch(0.72_0.18_155)]" : score >= 60 ? "text-primary" : "text-muted-foreground";
  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      <span className={`text-sm font-bold ${color}`}>{score}%</span>
      <Progress value={score} className="h-1 w-12" />
    </div>
  );
}

// ─── Scan Jobs for Me — primary, single-click flow ─────────────────────────

function ScanJobsPanel({ onSuccess }: { onSuccess: () => void }) {
  const [keyword, setKeyword] = useState("");
  const [locationType, setLocationType] = useState<LocationType>("any");
  const [scanning, setScanning] = useState(false);
  const fetchJobsFn = useServerFn(fetchJobs);
  const logSearchFn = useServerFn(logUserSearch);

  const handleScan = async () => {
    setScanning(true);
    try {
      const searchKeyword = keyword.trim() || "CV-based search";
      const result = await fetchJobsFn({
        data: { target_role: keyword.trim() || undefined, location_type: locationType },
      });
      // Log this search to history (show warning if it fails - helps debug missing table)
      const logResult = await logSearchFn({
        data: { keyword: searchKeyword, location_type: locationType, results_count: result.inserted ?? 0 },
      }).catch((e) => {
        console.warn("[ScanJobsPanel] Failed to log search history:", e.message);
        return { error: e.message };
      });
      if (logResult && 'error' in logResult) {
        toast.error("Search worked but history logging failed: " + logResult.error);
      }
      // Always refresh the job list - show results regardless of new vs existing
      toast.success(result.message);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message ?? "Scan failed — please try again.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card className="glass relative overflow-hidden border-border p-6">
      <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-primary/30 to-[oklch(0.70_0.20_295)]/30 pointer-events-none" />
      <div className="relative space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">Scan Jobs for Me</h2>
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px]">
            One click — no setup required
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          We search across job boards for you. Leave the keyword blank and we'll use your saved CV to figure out
          what to search for.
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            placeholder="Optional — e.g. Frontend Developer (leave blank to use your CV)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !scanning && handleScan()}
            disabled={scanning}
          />
          <Select value={locationType} onValueChange={(v) => setLocationType(v as LocationType)} disabled={scanning}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any location</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="onsite">On-site</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleScan}
          disabled={scanning}
          size="lg"
          className="w-full bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow sm:w-auto"
        >
          {scanning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning…
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" /> Scan Jobs for Me
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

// ─── Find My Matches — score scanned jobs against a chosen CV ─────────────

function MatchPanel({ cvs, onSuccess }: { cvs: CVOption[]; onSuccess: () => void }) {
  const [cvId, setCvId] = useState(cvs[0]?.id ?? "");
  const [matching, setMatching] = useState(false);
  const matchFn = useServerFn(matchJobsToCV);

  const handleMatch = async () => {
    if (!cvId) return toast.error("Select a CV first — build one in the CV Builder if you haven't.");
    setMatching(true);
    try {
      const result = await matchFn({ data: { cv_id: cvId } });
      if (result.scored > 0) {
        toast.success(result.message);
        onSuccess();
      } else {
        toast.info(result.message);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Matching failed — please try again.");
    } finally {
      setMatching(false);
    }
  };

  if (cvs.length === 0) {
    return (
      <Card className="glass border-border p-5">
        <p className="text-sm text-muted-foreground">
          Build a CV in the{" "}
          <a href="/dashboard/cv-builder" className="text-primary underline">
            CV Builder
          </a>{" "}
          first, then come back here to find your matches.
        </p>
      </Card>
    );
  }

  return (
    <Card className="glass border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Find My Matches</h2>
          <p className="text-xs text-muted-foreground">
            Score scanned jobs against a CV using AI. Already-scored jobs are skipped.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={cvId} onValueChange={setCvId} disabled={matching}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a CV…" />
            </SelectTrigger>
            <SelectContent>
              {cvs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleMatch}
            disabled={matching || !cvId}
            className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0"
          >
            {matching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Matching…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> Find My Matches
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Scrape Job Modal — secondary, optional manual path ────────────────────

function ScrapeModal({
  open,
  onClose,
  onSuccess,
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
      toast.success(`Added: "${result.title}"`);
      setUrl("");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Could not add that posting");
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
            Add a specific posting (optional)
          </DialogTitle>
          <DialogDescription>
            Already found a job somewhere? Paste the link here to add it manually — this isn't required for the
            normal flow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !scraping && handleScrape()}
              placeholder="https://…"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Auto-Apply Button ─────────────────────────────────────────────────────────

function AutoApplyButton({
  jobId,
  matchId,
  cvs,
  currentStatus,
  onApplied,
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
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={handleApply}
        disabled={applying}
        className="border-primary/40 text-primary hover:bg-primary/10 text-xs"
      >
        {applying ? (
          <>
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            Applying…
          </>
        ) : (
          <>
            <Send className="mr-1.5 h-3 w-3" />
            Auto-Apply
          </>
        )}
      </Button>
      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary/70 whitespace-nowrap">
        Beta
      </Badge>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

function Jobs() {
  const queryClient = useQueryClient();
  const { data: jobs } = useSuspenseQuery(jobsQO);
  const { data: myJobs } = useSuspenseQuery(myJobsQO);
  const { data: matches } = useSuspenseQuery(matchesQO);
  const { data: cvs } = useSuspenseQuery(cvsQO);
  const { data: prefs } = useSuspenseQuery(prefsQO);

  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [appliedMatchIds, setAppliedMatchIds] = useState<Set<string>>(new Set());

  const matchFn = useServerFn(matchJobsToCV);

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

  // Auto-matches against the user's most recently updated CV after a
  // successful scan, in addition to the manual "Find My Matches" button.
  const handleScanSuccess = async () => {
    // Refresh all job-related queries
    queryClient.invalidateQueries({ queryKey: ["scraped-jobs"] });
    queryClient.invalidateQueries({ queryKey: ["my-scanned-jobs"] });
    queryClient.invalidateQueries({ queryKey: ["search-history"] });
    const defaultCvId = (cvs as CVOption[])[0]?.id;
    if (defaultCvId) {
      try {
        await matchFn({ data: { cv_id: defaultCvId } });
        queryClient.invalidateQueries({ queryKey: ["job-matches"] });
      } catch {
        // Non-critical — user can always click "Find My Matches" manually.
      }
    }
  };

  const handleMatchSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["job-matches"] });
  };

  const handleApplied = (matchId: string) => {
    setAppliedMatchIds((prev) => new Set([...prev, matchId]));
  };

  return (
    <>
      <ScrapeModal open={scrapeOpen} onClose={() => setScrapeOpen(false)} onSuccess={handleScanSuccess} />

      <div className="mx-auto max-w-6xl space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Job Tracker &amp; Scanner</h1>
            <p className="text-sm text-muted-foreground">Live matches across hundreds of job boards.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
              <Activity className="h-3.5 w-3.5 animate-pulse text-[oklch(0.72_0.18_155)]" />
              Scanning <span className="mx-1 font-semibold text-foreground">4× daily</span>
            </div>
          </div>
        </div>

        {/* Primary action: Scan Jobs for Me */}
        <ScanJobsPanel onSuccess={handleScanSuccess} />

        {/* Score scanned jobs against a CV */}
        <MatchPanel cvs={cvs as CVOption[]} onSuccess={handleMatchSuccess} />

        {/* Secondary, low-emphasis manual option */}
        <button
          onClick={() => setScrapeOpen(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-primary"
        >
          <Link2 className="h-3 w-3" />
          Have a specific posting already? Add it manually instead.
        </button>

        {/* Notification Channels */}
        <Card className="glass border-border p-5">
          <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Notification Channels</p>
          <div className="grid gap-3 md:grid-cols-3">
            <ChannelRow
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              enabled={prefs.email}
              onChange={() => toggle("email")}
              saving={prefsMutation.isPending}
            />
            <ChannelRow
              icon={<MessageCircle className="h-4 w-4" />}
              label="Telegram"
              enabled={prefs.telegram}
              onChange={() => toggle("telegram")}
              saving={prefsMutation.isPending}
            />
            <ChannelRow
              icon={<Phone className="h-4 w-4" />}
              label="WhatsApp"
              enabled={prefs.whatsapp}
              onChange={() => toggle("whatsapp")}
              saving={prefsMutation.isPending}
            />
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">
              <Search className="mr-2 h-3.5 w-3.5" /> Your Search
              {(myJobs as ScrapedJob[]).length > 0 && (
                <Badge className="ml-2 bg-primary/20 text-primary border-0 text-[10px]">
                  {(myJobs as ScrapedJob[]).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="matches">
              <TrendingUp className="mr-2 h-3.5 w-3.5" /> My Matches
              {(matches as JobMatch[]).length > 0 && (
                <Badge className="ml-2 bg-primary/20 text-primary border-0 text-[10px]">
                  {(matches as JobMatch[]).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">
              <Search className="mr-2 h-3.5 w-3.5" /> Discover
            </TabsTrigger>
          </TabsList>

          {/* Your Search — private to this user, grouped by keyword */}
          <TabsContent value="mine">
            <p className="mb-2 text-xs text-muted-foreground">
              Jobs found by searches you've personally run. Each search shows its results below.
            </p>
            <Card className="glass overflow-hidden border-border">
              {(myJobs as ScrapedJob[]).length === 0 ? (
                <EmptyState
                  icon={<Search className="h-8 w-8 text-muted-foreground" />}
                  title="You haven't searched yet"
                  desc="Click 'Scan Jobs for Me' above to run your first search."
                />
              ) : (
                <div className="divide-y divide-border">
                  {/* Group jobs by search_query */}
                  {Object.entries(
                    (myJobs as ScrapedJob[]).reduce<Record<string, ScrapedJob[]>>((acc, job) => {
                      const key = job.search_query ?? "Unknown";
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(job);
                      return acc;
                    }, {})
                  ).map(([searchKeyword, jobs]) => (
                    <div key={searchKeyword}>
                      {/* Search keyword header */}
                      <div className="bg-card/60 px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <Search className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm font-semibold">"{searchKeyword}"</span>
                          <Badge variant="outline" className="text-[10px]">
                            {jobs.length} job{jobs.length !== 1 ? "s" : ""}
                          </Badge>
                          <span className="ml-auto text-xs text-muted-foreground">
                            Latest: {relTime(jobs[0]?.created_at ?? "")}
                          </span>
                        </div>
                      </div>
                      {/* Jobs for this search */}
                      <div className="grid grid-cols-[1fr_140px_120px_100px_40px] bg-card/40 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        <div>Job Title</div>
                        <div>Company</div>
                        <div>Location</div>
                        <div>Found</div>
                        <div />
                      </div>
                      {jobs.map((j) => (
                        <div
                          key={j.id}
                          className="grid grid-cols-[1fr_140px_120px_100px_40px] items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors"
                        >
                          <div>
                            <div className="text-sm font-medium">{j.job_title}</div>
                            {j.salary_range && (
                              <div className="text-xs text-[oklch(0.72_0.18_155)]">{j.salary_range}</div>
                            )}
                          </div>
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            {j.company}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {j.location ?? "—"}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {relTime(j.created_at)}
                          </span>
                          {j.url ? (
                            <a href={j.url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          ) : (
                            <div />
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* My Matches */}
          <TabsContent value="matches">
            <Card className="glass overflow-hidden border-border">
              {(matches as JobMatch[]).length === 0 ? (
                <EmptyState
                  icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />}
                  title="No matches yet"
                  desc="Click 'Scan Jobs for Me' or 'Find My Matches' above to get started."
                />
              ) : (
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-[1fr_140px_80px_120px_120px_40px] bg-card/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <div>Job</div>
                    <div>Company</div>
                    <div className="text-center">Match</div>
                    <div>Status</div>
                    <div>Action</div>
                    <div />
                  </div>
                  {(matches as JobMatch[]).map((m) => {
                    const job = m.scraped_jobs;
                    const isApplied = appliedMatchIds.has(m.id);
                    const effectiveStatus = isApplied ? "applied" : m.status;
                    return (
                      <div
                        key={m.id}
                        className="grid grid-cols-[1fr_140px_80px_120px_120px_40px] items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors"
                      >
                        <div>
                          <div className="text-sm font-medium">{job?.job_title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {job?.salary_range && (
                              <span className="text-xs text-[oklch(0.72_0.18_155)]">{job.salary_range}</span>
                            )}
                          </div>
                          {m.tailor_suggestions && (
                            <div className="mt-1 flex items-start gap-1">
                              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                {m.tailor_suggestions}
                              </p>
                            </div>
                          )}
                        </div>
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          {job?.company}
                        </span>
                        <ScoreBadge score={m.match_score ?? 0} />
                        <Badge
                          variant="outline"
                          className={`capitalize text-xs ${STATUS_STYLE[effectiveStatus] ?? STATUS_STYLE.matched}`}
                        >
                          {STATUS_LABEL[effectiveStatus] ?? effectiveStatus}
                        </Badge>
                        <AutoApplyButton
                          jobId={job?.id ?? m.id}
                          matchId={m.id}
                          cvs={cvs as CVOption[]}
                          currentStatus={effectiveStatus}
                          onApplied={handleApplied}
                        />
                        {job?.url ? (
                          <a href={job.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        ) : (
                          <div />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Discover — shared feed across everyone's searches */}
          <TabsContent value="all">
            <p className="mb-2 text-xs text-muted-foreground">
              A shared feed of postings found across everyone's searches — not just yours. Some won't match
              your profession; that's expected. Use "Find My Matches" above to see what's actually relevant to
              you.
            </p>
            <Card className="glass overflow-hidden border-border">
              {(jobs as ScrapedJob[]).length === 0 ? (
                <EmptyState
                  icon={<Search className="h-8 w-8 text-muted-foreground" />}
                  title="Nothing in the feed yet"
                  desc="Be the first — click 'Scan Jobs for Me' above. Your results join a shared feed everyone can browse."
                />
              ) : (
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-[1fr_140px_120px_100px_40px] bg-card/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <div>Job Title</div>
                    <div>Company</div>
                    <div>Location</div>
                    <div>Found</div>
                    <div />
                  </div>
                  {(jobs as ScrapedJob[]).map((j) => (
                    <div
                      key={j.id}
                      className="grid grid-cols-[1fr_140px_120px_100px_40px] items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium">{j.job_title}</div>
                        {j.salary_range && (
                          <div className="text-xs text-[oklch(0.72_0.18_155)]">{j.salary_range}</div>
                        )}
                        {j.search_query && (
                          <div className="text-[10px] text-muted-foreground/70">
                            found via: "{j.search_query}"
                          </div>
                        )}
                      </div>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        {j.company}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {j.location ?? "—"}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {relTime(j.created_at)}
                      </span>
                      {j.url ? (
                        <a href={j.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      ) : (
                        <div />
                      )}
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

function ChannelRow({
  icon,
  label,
  enabled,
  onChange,
  saving,
}: {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  onChange: () => void;
  saving: boolean;
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
