import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Power,
  Target,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  Loader2,
  FileText,
  Send,
  Copy,
  CheckCircle,
  AlertCircle,
  CircleDashed,
} from "lucide-react";
import {
  getAgentProfile,
  setAgentActive,
  listApplications,
  listAgentLogs,
  runAgentSequence,
} from "@/lib/agent.functions";
import React, { useState, useCallback } from "react";

const TELEGRAM_BOT = "HireMe_AIBot";

const profileQO = queryOptions({
  queryKey: ["agent", "profile"],
  queryFn: () => getAgentProfile(),
});
const queueQO = queryOptions({
  queryKey: ["agent", "applications", "active"],
  queryFn: () =>
    listApplications({ data: { statuses: ["queued", "processing"] } }),
});
const historyQO = queryOptions({
  queryKey: ["agent", "applications", "history"],
  queryFn: () =>
    listApplications({ data: { statuses: ["applied", "failed"] } }),
});
const logsQO = queryOptions({
  queryKey: ["agent", "logs"],
  queryFn: () => listAgentLogs(),
});

export const Route = createFileRoute("/_authenticated/dashboard/agent")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(profileQO);
    context.queryClient.ensureQueryData(queueQO);
    context.queryClient.ensureQueryData(historyQO);
    context.queryClient.ensureQueryData(logsQO);
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl p-8 text-center">
      <h2 className="text-lg font-semibold">Couldn't load the agent</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Not found.
    </div>
  ),
  component: Agent,
});

type AppRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  url: string | null;
  cv_label: string | null;
  match_score: number;
  status: string;
  note: string | null;
  applied_at: string | null;
  updated_at: string;
};

type LogRow = {
  id: string;
  created_at: string;
  action: string;
  status: string;
  company: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  applied:
    "bg-[oklch(0.72_0.18_155)]/15 text-[oklch(0.78_0.16_155)] border-[oklch(0.72_0.18_155)]/30",
  processing: "bg-primary/15 text-primary border-primary/30",
  queued: "bg-muted text-muted-foreground border-border",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function Agent() {
  const router = useRouter();
  const { data: profile } = useSuspenseQuery(profileQO);
  const { data: queue } = useSuspenseQuery(queueQO);
  const { data: history } = useSuspenseQuery(historyQO);
  const { data: logs } = useSuspenseQuery(logsQO);

  const toggleFn = useServerFn(setAgentActive);
  const toggle = useMutation({
    mutationFn: (active: boolean) => toggleFn({ data: { active } }),
    onSuccess: ({ active }) => {
      router.invalidate();
      toast.success(active ? "Agent activated" : "Agent paused");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = profile.agent_active;
  const telegramConnected = Boolean(profile.telegram_chat_id);
  const deepLink = `https://t.me/${TELEGRAM_BOT}?start=${profile.id}`;

  const queued = (queue as AppRow[]).filter(
    (j) => j.status === "queued",
  ).length;
  const processing = (queue as AppRow[]).filter(
    (j) => j.status === "processing",
  ).length;
  const applied = (history as AppRow[]).filter(
    (j) => j.status === "applied",
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">Autonomous Agent Command</h1>
          <Badge
            variant="outline"
            className="border-primary/40 bg-primary/10 text-primary"
          >
            <FlaskConical className="mr-1 h-3 w-3" /> Beta · Phase 1 &amp; 2
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          An AI worker that queues and applies to jobs on your behalf.
        </p>
      </div>

      <Card className="glass relative overflow-hidden border-border p-6">
        <div
          className={`absolute inset-0 opacity-30 transition ${active ? "bg-gradient-to-br from-primary/20 to-[oklch(0.70_0.20_295)]/20" : ""}`}
        />
        <div className="relative flex flex-col items-center gap-5 md:flex-row md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`grid h-14 w-14 place-items-center rounded-2xl transition ${active ? "bg-gradient-to-br from-primary to-[oklch(0.70_0.20_295)] glow" : "bg-muted"}`}
            >
              <Bot
                className={`h-7 w-7 ${active ? "text-primary-foreground" : "text-muted-foreground"}`}
              />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Agent Status
              </div>
              <div className="flex items-center gap-2 text-2xl font-bold">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${active ? "animate-pulse bg-[oklch(0.72_0.18_155)]" : "bg-muted-foreground/50"}`}
                />
                {active ? "ACTIVE" : "IDLE"}
              </div>
            </div>
          </div>
          <Button
            size="lg"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(!active)}
            className={
              active
                ? "bg-destructive text-destructive-foreground border-0"
                : "bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow"
            }
          >
            {toggle.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Power className="mr-2 h-4 w-4" />
            )}
            {active ? "Deactivate Agent" : "Activate Agent"}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          icon={CheckCircle2}
          label="Applied"
          value={applied.toString()}
          accent
        />
        <Metric
          icon={Loader2}
          label="Processing / Queued"
          value={`${processing} / ${queued}`}
        />
        <Metric
          icon={Target}
          label="Active in pipeline"
          value={(queue as AppRow[]).length.toString()}
        />
        <Metric
          icon={Clock}
          label="Logged steps"
          value={(logs as LogRow[]).length.toString()}
        />
      </div>

      <AgentRunner />

      <NotificationConfig
        connected={telegramConnected}
        deepLink={deepLink}
        chatId={profile.telegram_chat_id ?? null}
      />

      <Card className="glass border-border p-0">
        <Tabs defaultValue="active" className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Application Pipeline</h2>
              <p className="text-xs text-muted-foreground">
                Live queue and historical submissions.
              </p>
            </div>
            <TabsList>
              <TabsTrigger value="active">
                Active Queue ({(queue as AppRow[]).length})
              </TabsTrigger>
              <TabsTrigger value="history">
                History ({(history as AppRow[]).length})
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="active" className="m-0">
            <JobList
              jobs={queue as AppRow[]}
              empty="No jobs in queue. Activate the agent to start sourcing."
            />
          </TabsContent>
          <TabsContent value="history" className="m-0">
            <JobList
              jobs={history as AppRow[]}
              empty="No applications submitted yet."
            />
          </TabsContent>
        </Tabs>
      </Card>

      <StepTracker logs={logs as LogRow[]} />
    </div>
  );
}

const AGENT_PHASES = [
  {
    delay: 0,
    text: "\u{1F916} Phase 1: Analyzing Greenhouse/Lever ATS form schema...",
  },
  {
    delay: 1200,
    text: "\u{1F9E0} Phase 2: Utilizing Gemini to inject matching skill keywords safely into CV layout...",
  },
  {
    delay: 2400,
    text: "\u{1F680} Phase 3: Packaging secure background application payload...",
  },
];

function AgentRunner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<number | null>(null);
  const [jobUrl, setJobUrl] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");

  const runFn = useServerFn(runAgentSequence);

  const isRunning = phase !== null;

  const handleRun = useCallback(async () => {
    if (!jobTitle.trim() || !company.trim()) {
      toast.error("Enter a job title and company to run the agent.");
      return;
    }

    // Phase animation sequence
    setPhase(0);
    await new Promise((r) => setTimeout(r, 1200));
    setPhase(1);
    await new Promise((r) => setTimeout(r, 1200));
    setPhase(2);
    await new Promise((r) => setTimeout(r, 1200));

    try {
      const result = await runFn({
        data: {
          job_id: crypto.randomUUID(),
          job_title: jobTitle.trim(),
          company: company.trim(),
          url: jobUrl.trim(),
        },
      });

      if (result.ats_supported) {
        toast.success("Application submitted successfully via beta agent!");
      } else {
        toast.warning(
          "Custom framework detected. Application queued for manual override agent processing.",
        );
      }

      router.invalidate();
      queryClient.invalidateQueries({ queryKey: ["agent"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Agent sequence failed.");
    } finally {
      setPhase(null);
    }
  }, [jobTitle, company, jobUrl, runFn, router, queryClient]);

  return (
    <Card className="glass relative overflow-hidden border-border p-6">
      <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-primary/30 to-[oklch(0.70_0.20_295)]/30 pointer-events-none" />
      <div className="relative space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Run Agent Sequence</h2>
          <Badge
            variant="outline"
            className="border-primary/40 bg-primary/10 text-primary text-[10px]"
          >
            Beta Phase — Enabled for Standard ATS Forms Only
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Trigger the autonomous application pipeline for a specific job. The
          agent analyzes the ATS, tailors keywords, and submits a background
          application.
        </p>

        {isRunning ? (
          <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
            {AGENT_PHASES.map((p, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-sm transition-opacity duration-300 ${
                  phase !== null && i <= phase ? "opacity-100" : "opacity-30"
                }`}
              >
                {phase !== null && i < phase ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[oklch(0.72_0.18_155)]" />
                ) : phase !== null && i === phase ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span>{p.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Job title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Job URL (optional)"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
            />
          </div>
        )}

        <Button
          disabled={isRunning}
          onClick={handleRun}
          className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow"
        >
          {isRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bot className="mr-2 h-4 w-4" />
          )}
          {isRunning ? "Processing..." : "Execute Agent Sequence"}
        </Button>
      </div>
    </Card>
  );
}

function NotificationConfig({
  connected,
  deepLink,
  chatId,
}: {
  connected: boolean;
  deepLink: string;
  chatId: string | null;
}) {
  return (
    <Card className="glass relative overflow-hidden border-border p-6">
      <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-[oklch(0.65_0.18_230)]/40 to-[oklch(0.70_0.20_295)]/30 pointer-events-none" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[oklch(0.65_0.18_230)] to-[oklch(0.70_0.20_295)] text-primary-foreground glow">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Notification Configuration
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] bg-clip-text text-2xl font-bold text-transparent">
                @{TELEGRAM_BOT}
              </span>
              {connected ? (
                <Badge
                  variant="outline"
                  className="border-[oklch(0.72_0.18_155)]/40 bg-[oklch(0.72_0.18_155)]/15 text-[oklch(0.78_0.16_155)]"
                >
                  <CheckCircle className="mr-1 h-3 w-3" /> Telegram Connected
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-border bg-muted text-muted-foreground"
                >
                  <CircleDashed className="mr-1 h-3 w-3" /> Disconnected
                </Badge>
              )}
            </div>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              {connected
                ? `Chat ID linked (${chatId}). You'll receive real-time agent updates on Telegram.`
                : "Open the bot to link your account — the agent will then DM you progress updates."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(deepLink);
              toast.success("Link copied");
            }}
          >
            <Copy className="mr-1.5 h-4 w-4" /> Copy link
          </Button>
          <a href={deepLink} target="_blank" rel="noopener noreferrer">
            <Button className="bg-gradient-to-r from-[oklch(0.65_0.18_230)] to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow">
              <Send className="mr-1.5 h-4 w-4" />{" "}
              {connected ? "Open bot" : "Connect Telegram"}
            </Button>
          </a>
        </div>
      </div>
    </Card>
  );
}

function StepTracker({ logs }: { logs: LogRow[] }) {
  return (
    <Card className="glass border-border p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Application Step Tracker</h2>
          <p className="text-xs text-muted-foreground">
            Every action the agent performs, oldest at the bottom.
          </p>
        </div>
      </div>
      {logs.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No agent activity yet. Activate the agent to start logging steps.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          <li className="grid grid-cols-12 gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <div className="col-span-3">Timestamp</div>
            <div className="col-span-5">Action</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Company</div>
          </li>
          {logs.map((l) => (
            <li
              key={l.id}
              className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm"
            >
              <div className="col-span-3 text-xs text-muted-foreground">
                {relTime(l.created_at)}
              </div>
              <div className="col-span-5 truncate">{l.action}</div>
              <div className="col-span-2">
                <StepStatus status={l.status} />
              </div>
              <div className="col-span-2 truncate text-xs text-muted-foreground">
                {l.company ?? "—"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StepStatus({ status }: { status: string }) {
  if (status === "success") {
    return (
      <Badge
        variant="outline"
        className="border-[oklch(0.72_0.18_155)]/30 bg-[oklch(0.72_0.18_155)]/15 text-[oklch(0.78_0.16_155)]"
      >
        <CheckCircle className="mr-1 h-3 w-3" /> Success
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge
        variant="outline"
        className="border-destructive/30 bg-destructive/15 text-destructive"
      >
        <AlertCircle className="mr-1 h-3 w-3" /> Failed
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-[oklch(0.80_0.16_80)]/40 bg-[oklch(0.80_0.16_80)]/15 text-[oklch(0.80_0.16_80)]"
    >
      <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[oklch(0.80_0.16_80)]" />{" "}
      Pending
    </Badge>
  );
}

function JobList({ jobs, empty }: { jobs: AppRow[]; empty: string }) {
  if (jobs.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {jobs.map((j) => (
        <li
          key={j.id}
          className="flex flex-col gap-3 p-4 transition hover:bg-card/40 md:flex-row md:items-center md:justify-between"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{j.title}</span>
              <Badge
                variant="outline"
                className={`capitalize ${STATUS_STYLE[j.status] ?? STATUS_STYLE.queued}`}
              >
                {j.status === "processing" && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                {j.status}
              </Badge>
              <Badge
                variant="outline"
                className="border-border/60 text-[10px] font-normal text-muted-foreground"
              >
                Match {j.match_score}%
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {j.company}
              </span>
              {j.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {j.location}
                </span>
              )}
              {j.salary && (
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {j.salary}
                </span>
              )}
              {j.cv_label && (
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {j.cv_label}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {relTime(j.applied_at ?? j.updated_at)}
              </span>
            </div>
            {j.note && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {j.note}
              </p>
            )}
          </div>
          {j.url && (
            <div className="shrink-0">
              <a href={j.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View posting
                </Button>
              </a>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card className={`glass border-border p-5 ${accent ? "glow" : ""}`}>
      <div className="flex items-center gap-3">
        <div
          className={`grid h-9 w-9 place-items-center rounded-lg ${accent ? "bg-gradient-to-br from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground" : "bg-muted text-primary"}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}
