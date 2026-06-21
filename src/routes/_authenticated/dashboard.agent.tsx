// src/routes/_authenticated/dashboard.agent.tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Loader2,
  Briefcase,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { matchJobsToCV } from "@/lib/match.functions";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ─────────────────────────────────────────────────────────────────

type CVOption = { id: string; title: string };

type ScrapedJob = {
  id: string;
  job_title: string;
  company: string;
  job_description: string | null;
  salary_range: string | null;
  location: string | null;
  url: string | null;
  source: string | null;
  created_at: string;
};

// ─── Queries ────────────────────────────────────────────────────────────────

const cvsQO = queryOptions({
  queryKey: ["cvs", "list"],
  queryFn: async (): Promise<CVOption[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("cvs")
      .select("id, title")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[cvsQO] Failed to fetch CVs:", error.message);
      return [];
    }
    return (data ?? []).map((c) => ({ id: c.id, title: c.title }));
  },
});

const scrapedJobsQO = queryOptions({
  queryKey: ["scraped-jobs"],
  queryFn: async (): Promise<ScrapedJob[]> => {
    const { data, error } = await supabase
      .from("scraped_jobs")
      .select("id, job_title, company, job_description, salary_range, location, url, source, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error("[scrapedJobsQO] Failed to fetch jobs:", error.message);
      return [];
    }
    return data ?? [];
  },
});

// ─── Route ────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/dashboard/agent")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(cvsQO);
    context.queryClient.ensureQueryData(scrapedJobsQO);
  },
  component: Jobs,
});

// ─── ScanJobsPanel (existing component) ──────────────────────────────────

function ScanJobsPanel({ onSuccess }: { onSuccess: () => void }) {
  const [scanning, setScanning] = useState(false);
  const scanJobsFn = useServerFn(async ({ data }: { data: { target_role?: string; location_type?: string } }) => {
    const { fetchJobs } = await import("@/lib/jobs.functions");
    return fetchJobs({ data: { target_role: data.target_role, location_type: data.location_type as any } });
  });

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const result = await scanJobsFn({ data: {} });
      toast.success(result.message || "Scan completed!");
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || "Scan failed.");
    } finally {
      setScanning(false);
    }
  }, [onSuccess, scanJobsFn]);

  return (
    <Card className="glass border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Scan Jobs for Me</h2>
          <p className="text-xs text-muted-foreground">
            Find fresh job postings matching your profile.
          </p>
        </div>
        <Button
          onClick={handleScan}
          disabled={scanning}
          className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0"
        >
          {scanning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning…
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" /> Scan Jobs
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

// ─── MatchPanel (NEW) ────────────────────────────────────────────────────

function MatchPanel({
  cvs,
  onSuccess,
}: {
  cvs: CVOption[];
  onSuccess: () => void;
}) {
  const [cvId, setCvId] = useState(cvs[0]?.id ?? "");
  const [matching, setMatching] = useState(false);
  const matchFn = useServerFn(matchJobsToCV);

  const handleMatch = async () => {
    if (!cvId) {
      toast.error(
        "Select a CV first — build one in the CV Builder if you haven't."
      );
      return;
    }
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
            Score scanned jobs against a CV using AI. Already-scored jobs are
            skipped.
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

// ─── Main Jobs Component ─────────────────────────────────────────────────

function Jobs() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Load CVs and jobs from Supabase (persisted state)
  const { data: cvs } = useSuspenseQuery(cvsQO);
  const { data: jobs } = useSuspenseQuery(scrapedJobsQO);

  const matchFn = useServerFn(matchJobsToCV);

  // Handle scan success: invalidate jobs query and auto-match against the most recent CV
  const handleScanSuccess = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["scraped-jobs"] });
    const defaultCvId = (cvs as CVOption[])[0]?.id;
    if (defaultCvId) {
      try {
        await matchFn({ data: { cv_id: defaultCvId } });
        queryClient.invalidateQueries({ queryKey: ["job-matches"] });
      } catch {
        // Non-critical — user can always click "Find My Matches" manually.
      }
    }
  }, [cvs, matchFn, queryClient]);

  const handleMatchSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["job-matches"] });
  }, [queryClient]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Job Tracker</h1>
        <p className="text-sm text-muted-foreground">
          Discover and manage job opportunities.
        </p>
      </div>

      {/* Scan panel */}
      <ScanJobsPanel onSuccess={handleScanSuccess} />

      {/* Match panel */}
      <MatchPanel cvs={cvs as CVOption[]} onSuccess={handleMatchSuccess} />

      {/* Job list (persisted from Supabase) */}
      <Card className="glass border-border p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Scanned Jobs</h2>
            <p className="text-xs text-muted-foreground">
              All jobs found by the scanner (persisted in database).
            </p>
          </div>
          <Badge variant="outline">{jobs.length} jobs</Badge>
        </div>
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No jobs scanned yet. Hit "Scan Jobs" to get started.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {jobs.map((j: ScrapedJob) => (
              <li
                key={j.id}
                className="flex flex-col gap-3 p-4 transition hover:bg-card/40 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{j.job_title}</span>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {j.source ?? "New"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {j.company || "Unknown"}
                    </span>
                    {j.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {j.location}
                      </span>
                    )}
                    {j.salary_range && (
                      <span className="inline-flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {j.salary_range}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(j.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {j.url && (
                  <div className="shrink-0">
                    <a href={j.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View
                      </Button>
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
