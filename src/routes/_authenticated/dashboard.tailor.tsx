import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, ArrowRight, Loader2, CheckCircle2, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { tailorCV, listCVs } from "@/lib/cv.functions";

export const Route = createFileRoute("/_authenticated/dashboard/tailor")({
  component: Tailor,
});

type CVMeta = { id: string; title: string; updated_at: string };

function Tailor() {
  const [cvs, setCVs] = useState<CVMeta[]>([]);
  const [cvId, setCVId] = useState<string>("");
  const [jd, setJD] = useState("");
  const [tailoring, setTailoring] = useState(false);
  const [result, setResult] = useState<{
    title: string;
    changes_summary: string;
    cv_id: string;
  } | null>(null);

  const tailorFn = useServerFn(tailorCV);
  const listFn = useServerFn(listCVs);

  // Load saved CVs for the dropdown
  useEffect(() => {
    (async () => {
      try {
        const data = await listFn();
        const list = data as CVMeta[];
        setCVs(list);
        if (list.length > 0) setCVId(list[0].id);
      } catch {
        // fallback: fetch directly from client
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("cvs").select("id, title, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
        const list = (data ?? []) as CVMeta[];
        setCVs(list);
        if (list.length > 0) setCVId(list[0].id);
      }
    })();
  }, []);

  const generate = async () => {
    if (!cvId) return toast.error("Select a CV first");
    if (!jd.trim()) return toast.error("Paste a job description first");
    setTailoring(true);
    setResult(null);
    try {
      const res = await tailorFn({ data: { cv_id: cvId, job_description: jd } });
      setResult(res);
      toast.success("CV tailored! A new version has been saved.");
    } catch (e: any) {
      toast.error(e.message ?? "Tailoring failed — check your Gemini API key.");
    } finally {
      setTailoring(false);
    }
  };

  const reset = () => {
    setResult(null);
    setJD("");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">AI Tailor Engine</h1>
        <p className="text-sm text-muted-foreground">
          Paste a job description — Gemini rewrites your summary and bullet points to match the role's keywords while keeping every fact accurate.
        </p>
      </div>

      {/* Input card */}
      <Card className="glass border-border p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Source CV</label>
            {cvs.length === 0 ? (
              <p className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                No CVs saved yet. Build one in the{" "}
                <a href="/dashboard/cv-builder" className="underline text-primary">CV Builder</a> first.
              </p>
            ) : (
              <Select value={cvId} onValueChange={setCVId} disabled={tailoring}>
                <SelectTrigger><SelectValue placeholder="Select a CV…" /></SelectTrigger>
                <SelectContent>
                  {cvs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Job description</label>
            <Textarea
              rows={8}
              value={jd}
              onChange={(e) => setJD(e.target.value)}
              placeholder="Paste the full job posting here — the more detail, the better the tailoring…"
              disabled={tailoring}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            A new tailored CV version is saved automatically — your original is never overwritten.
          </p>
          <Button
            onClick={generate}
            disabled={tailoring || !jd.trim() || !cvId}
            className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow"
          >
            {tailoring
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Tailoring with Gemini…</>
              : <><Sparkles className="mr-2 h-4 w-4" />Generate tailored CV</>}
          </Button>
        </div>
      </Card>

      {/* Loading skeleton */}
      {tailoring && (
        <Card className="glass border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-medium">Gemini is analyzing the job description and rewriting your CV…</p>
          </div>
          <div className="space-y-2">
            {[90, 75, 60, 85].map((w, i) => (
              <div key={i} className="h-3 rounded-full bg-muted animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        </Card>
      )}

      {/* Results card */}
      {result && !tailoring && (
        <Card className="glass border-border p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-[oklch(0.72_0.18_155)]/15 text-[oklch(0.78_0.16_155)] border-[oklch(0.72_0.18_155)]/30">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Tailored Successfully
                </Badge>
              </div>
              <h2 className="mt-2 text-sm font-semibold">{result.title}</h2>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Tailor another
            </Button>
          </div>

          <Alert className="border-[oklch(0.72_0.18_155)]/40 bg-[oklch(0.72_0.18_155)]/10">
            <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.18_155)]" />
            <AlertDescription className="text-sm leading-relaxed">
              <strong>What changed:</strong> {result.changes_summary}
            </AlertDescription>
          </Alert>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5 text-primary" />
              The tailored CV has been saved as <span className="font-semibold text-foreground">"{result.title}"</span>.
              You can view it in the{" "}
              <a href="/dashboard/cv-builder" className="text-primary underline">CV Builder</a>
              {" "}or download it from there.
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}