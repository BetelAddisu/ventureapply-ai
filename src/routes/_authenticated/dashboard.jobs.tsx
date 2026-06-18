import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Activity, Mail, MessageCircle, Phone, Search, ExternalLink, Bot,
  Building2, MapPin, Calendar,
} from "lucide-react";
import { toast } from "sonner";

// ─── Server functions ──────────────────────────────────────────────────────────

const listScrapedJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scraped_jobs")
      .select("id, title, company, location, url, created_at, status")
      .order("created_at", { ascending: false })
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
const prefsQO = queryOptions({ queryKey: ["notif-prefs"], queryFn: () => getNotifPrefs() });

export const Route = createFileRoute("/_authenticated/dashboard/jobs")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(jobsQO);
    context.queryClient.ensureQueryData(prefsQO);
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  component: Jobs,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type JobRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  created_at: string;
  status: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  matched: "bg-primary/15 text-primary border-primary/30",
  tailored: "bg-[oklch(0.70_0.20_295)]/15 text-[oklch(0.78_0.18_295)] border-[oklch(0.70_0.20_295)]/30",
  applied: "bg-[oklch(0.72_0.18_155)]/15 text-[oklch(0.78_0.16_155)] border-[oklch(0.72_0.18_155)]/30",
  new: "bg-muted text-muted-foreground border-border",
};

function relTime(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

function Jobs() {
  const queryClient = useQueryClient();
  const { data: jobs } = useSuspenseQuery(jobsQO);
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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Job Tracker & Scanner</h1>
          <p className="text-sm text-muted-foreground">Live matches across hundreds of job boards.</p>
        </div>
        <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
          <Activity className="h-3.5 w-3.5 animate-pulse text-[oklch(0.72_0.18_155)]" />
          <span>Scanning <span className="font-semibold text-foreground">4× daily</span></span>
        </div>
      </div>

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

      {/* Jobs Table */}
      <Card className="glass overflow-hidden border-border">
        {(jobs as JobRow[]).length === 0 ? (
          <EmptyState />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Job Title</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Found</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(jobs as JobRow[]).map((j) => (
                <TableRow key={j.id} className="border-border">
                  <TableCell className="font-medium">{j.title}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />{j.company}
                    </span>
                  </TableCell>
                  <TableCell>
                    {j.location ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />{j.location}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />{relTime(j.created_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`capitalize ${STATUS_STYLE[j.status ?? "new"] ?? STATUS_STYLE.new}`}
                    >
                      {j.status ?? "new"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {j.url && (
                      <a href={j.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-semibold">No jobs scanned yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The scanner runs when the autonomous agent is active. Activate it from the Agent tab to start sourcing jobs.
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
