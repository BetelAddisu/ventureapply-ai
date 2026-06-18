import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/tailor")({
  component: Tailor,
});

type Diff = { section: string; before: string; after: string };

function Tailor() {
  const [cvs, setCVs] = useState<{ id: string; title: string }[]>([]);
  const [cvId, setCVId] = useState<string>("");
  const [jd, setJD] = useState("");
  const [loading, setLoading] = useState(false);
  const [diffs, setDiffs] = useState<Diff[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("cvs").select("id, title").eq("user_id", user.id);
      setCVs(data ?? []);
      if (data?.[0]) setCVId(data[0].id);
    })();
  }, []);

  const generate = () => {
    if (!jd.trim()) return;
    setLoading(true);
    setDiffs(null);
    setTimeout(() => {
      // mock micro-adjustment suggestions
      const kw = jd.match(/\b([A-Z][a-zA-Z]+|[a-z]{4,})\b/g) ?? [];
      const top = Array.from(new Set(kw)).slice(0, 3);
      setDiffs([
        { section: "Summary headline", before: "Product engineer with a focus on web platforms.", after: `Product engineer specialising in ${top[0] ?? "scalable"} systems and ${top[1] ?? "modern"} stacks.` },
        { section: "Skills", before: "React, Node, TypeScript", after: `React, Node, TypeScript, ${top[2] ?? "GraphQL"}` },
        { section: "Experience bullet #1", before: "Built dashboards and internal tools.", after: `Shipped ${top[0] ?? "real-time"} dashboards used by 50+ teams, improving decision speed 3×.` },
        { section: "Experience bullet #2", before: "Worked closely with design.", after: `Partnered with design and PM to deliver ${top[1] ?? "high-impact"} features end-to-end.` },
      ]);
      setLoading(false);
    }, 1400);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">AI Tailor Engine</h1>
        <p className="text-sm text-muted-foreground">Paste a job description, get surgical CV adjustments.</p>
      </div>

      <Card className="glass border-border p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Source CV</label>
            <Select value={cvId} onValueChange={setCVId}>
              <SelectTrigger><SelectValue placeholder={cvs.length ? "Select CV" : "No CVs yet"} /></SelectTrigger>
              <SelectContent>
                {cvs.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Job description</label>
            <Textarea rows={6} value={jd} onChange={(e) => setJD(e.target.value)} placeholder="Paste the full job posting here…" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={generate} disabled={loading || !jd.trim()} className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0">
            <Sparkles className="mr-2 h-4 w-4" /> Generate micro-adjustments
          </Button>
        </div>
      </Card>

      {loading && (
        <Card className="glass border-border p-5">
          <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Analyzing job description…</p>
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        </Card>
      )}

      {diffs && (
        <Card className="glass border-border p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Suggested adjustments</h2>
          <div className="mt-4 space-y-3">
            {diffs.map((d, i) => (
              <div key={i} className="rounded-xl border border-border bg-card/40 p-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">{d.section}</p>
                <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm line-through opacity-80">{d.before}</div>
                  <ArrowRight className="hidden h-4 w-4 text-primary md:block" />
                  <div className="rounded-md border border-[oklch(0.72_0.18_155)]/40 bg-[oklch(0.72_0.18_155)]/10 p-3 text-sm">{d.after}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline">Reject all</Button>
            <Button className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0">Apply changes</Button>
          </div>
        </Card>
      )}
    </div>
  );
}