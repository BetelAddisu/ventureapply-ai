import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Save, Loader2, Trash2, Sparkles, FileUp, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { tailorCV, parseCV, listCVs } from "@/lib/cv.functions";

export const Route = createFileRoute("/_authenticated/dashboard/cv-builder")({
  component: CVBuilder,
});

type Experience = { role: string; company: string; period: string; bullets: string };
type Education = { degree: string; school: string; year: string };
type CV = {
  profile: { name: string; title: string; email: string; phone: string; summary: string };
  experiences: Experience[];
  education: Education[];
  skills: string;
};

type CVMeta = { id: string; title: string; updated_at: string };

const empty: CV = {
  profile: { name: "", title: "", email: "", phone: "", summary: "" },
  experiences: [{ role: "", company: "", period: "", bullets: "" }],
  education: [{ degree: "", school: "", year: "" }],
  skills: "",
};

function CVBuilder() {
  const [cv, setCV] = useState<CV>(empty);
  const [title, setTitle] = useState("My Resume");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  // Tailor state
  const [savedCVs, setSavedCVs] = useState<CVMeta[]>([]);
  const [selectedCVId, setSelectedCVId] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tailoring, setTailoring] = useState(false);
  const [tailorSummary, setTailorSummary] = useState("");

  // Parser state
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);

  const tailorFn = useServerFn(tailorCV);
  const parseFn = useServerFn(parseCV);
  const listFn = useServerFn(listCVs);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("cvs").select("*").eq("user_id", user.id)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setTitle(data.title);
        const raw = data.raw_json_data as any;
        if (raw?.profile) setCV(raw as CV);
      }
      // Also load CV list for tailor tab
      try {
        const cvs = await listFn();
        setSavedCVs(cvs as CVMeta[]);
        if ((cvs as CVMeta[]).length > 0) setSelectedCVId((cvs as CVMeta[])[0].id);
      } catch { /* non-critical */ }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from("cvs").upsert(
      { user_id: user.id, title, raw_json_data: cv as any },
      { onConflict: "user_id,title" as any }
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("CV saved");
    // Refresh list
    try {
      const cvs = await listFn();
      setSavedCVs(cvs as CVMeta[]);
    } catch { /* non-critical */ }
  };

  const handleTailor = async () => {
    if (!selectedCVId) return toast.error("Select a CV to tailor");
    if (!jobDescription.trim()) return toast.error("Paste a job description first");
    setTailoring(true);
    setTailorSummary("");
    try {
      const result = await tailorFn({ data: { cv_id: selectedCVId, job_description: jobDescription } });
      setCV(result.tailored_cv);
      setTitle(result.title);
      setTailorSummary(result.changes_summary);
      toast.success("CV tailored! Review the changes in the Preview.");
      setActiveTab("profile");
    } catch (e: any) {
      toast.error(e.message ?? "Tailoring failed");
    } finally {
      setTailoring(false);
    }
  };

  const handleParse = async () => {
    if (!rawText.trim()) return toast.error("Paste your CV text first");
    setParsing(true);
    try {
      const parsed = await parseFn({ data: { raw_text: rawText } });
      setCV(parsed as CV);
      setRawText("");
      toast.success("CV parsed — review and edit before saving");
      setActiveTab("profile");
    } catch (e: any) {
      toast.error(e.message ?? "Parsing failed");
    } finally {
      setParsing(false);
    }
  };

  const updateProfile = (k: keyof CV["profile"], v: string) =>
    setCV({ ...cv, profile: { ...cv.profile, [k]: v } });

  return (
    <div className="grid h-[calc(100vh-7rem)] gap-4 lg:grid-cols-2">
      {/* Editor */}
      <Card className="glass flex flex-col overflow-hidden border-border">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex-1">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-0 bg-transparent text-lg font-semibold focus-visible:ring-0"
            />
          </div>
          <Button
            onClick={save}
            disabled={saving}
            size="sm"
            className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save</>}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="m-3 grid grid-cols-5">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="experience">Exp.</TabsTrigger>
            <TabsTrigger value="education">Edu.</TabsTrigger>
            <TabsTrigger value="tailor" className="text-primary">AI Tailor</TabsTrigger>
            <TabsTrigger value="parser">Parser</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-4 pt-0">

            {/* ── Profile ── */}
            <TabsContent value="profile" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name"><Input value={cv.profile.name} onChange={(e) => updateProfile("name", e.target.value)} /></Field>
                <Field label="Title"><Input value={cv.profile.title} onChange={(e) => updateProfile("title", e.target.value)} /></Field>
                <Field label="Email"><Input value={cv.profile.email} onChange={(e) => updateProfile("email", e.target.value)} /></Field>
                <Field label="Phone"><Input value={cv.profile.phone} onChange={(e) => updateProfile("phone", e.target.value)} /></Field>
              </div>
              <Field label="Summary"><Textarea rows={4} value={cv.profile.summary} onChange={(e) => updateProfile("summary", e.target.value)} /></Field>
              <Field label="Skills (comma-separated)">
                <Textarea rows={2} value={cv.skills} onChange={(e) => setCV({ ...cv, skills: e.target.value })} placeholder="React, TypeScript, Node…" />
              </Field>
            </TabsContent>

            {/* ── Experience ── */}
            <TabsContent value="experience" className="space-y-4">
              {cv.experiences.map((exp, i) => (
                <Card key={i} className="border-border bg-card/40 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Role" value={exp.role} onChange={(e) => { const a = [...cv.experiences]; a[i].role = e.target.value; setCV({ ...cv, experiences: a }); }} />
                    <Input placeholder="Company" value={exp.company} onChange={(e) => { const a = [...cv.experiences]; a[i].company = e.target.value; setCV({ ...cv, experiences: a }); }} />
                  </div>
                  <Input className="mt-2" placeholder="Period (e.g. 2022 — Present)" value={exp.period} onChange={(e) => { const a = [...cv.experiences]; a[i].period = e.target.value; setCV({ ...cv, experiences: a }); }} />
                  <Textarea className="mt-2" rows={3} placeholder="• Led … • Shipped …" value={exp.bullets} onChange={(e) => { const a = [...cv.experiences]; a[i].bullets = e.target.value; setCV({ ...cv, experiences: a }); }} />
                  <Button variant="ghost" size="sm" className="mt-1 text-destructive" onClick={() => setCV({ ...cv, experiences: cv.experiences.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={() => setCV({ ...cv, experiences: [...cv.experiences, { role: "", company: "", period: "", bullets: "" }] })}>
                <Plus className="mr-2 h-4 w-4" /> Add experience
              </Button>
            </TabsContent>

            {/* ── Education ── */}
            <TabsContent value="education" className="space-y-4">
              {cv.education.map((ed, i) => (
                <Card key={i} className="border-border bg-card/40 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Degree" value={ed.degree} onChange={(e) => { const a = [...cv.education]; a[i].degree = e.target.value; setCV({ ...cv, education: a }); }} />
                    <Input placeholder="School" value={ed.school} onChange={(e) => { const a = [...cv.education]; a[i].school = e.target.value; setCV({ ...cv, education: a }); }} />
                  </div>
                  <Input className="mt-2" placeholder="Year" value={ed.year} onChange={(e) => { const a = [...cv.education]; a[i].year = e.target.value; setCV({ ...cv, education: a }); }} />
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={() => setCV({ ...cv, education: [...cv.education, { degree: "", school: "", year: "" }] })}>
                <Plus className="mr-2 h-4 w-4" /> Add education
              </Button>
            </TabsContent>

            {/* ── AI Tailor ── */}
            <TabsContent value="tailor" className="space-y-4">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">AI Tailor Engine</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Gemini rewrites your summary and bullet points to match the job's keywords — all facts stay accurate.
                </p>
              </div>

              {tailorSummary && (
                <Alert className="border-[oklch(0.72_0.18_155)]/40 bg-[oklch(0.72_0.18_155)]/10">
                  <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.18_155)]" />
                  <AlertDescription className="text-sm">{tailorSummary}</AlertDescription>
                </Alert>
              )}

              <Field label="Which CV to tailor?">
                {savedCVs.length === 0 ? (
                  <p className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                    Save a CV first using the Profile and Experience tabs, then come back here.
                  </p>
                ) : (
                  <Select value={selectedCVId} onValueChange={setSelectedCVId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select a CV…" /></SelectTrigger>
                    <SelectContent>
                      {savedCVs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field label="Paste job description">
                <Textarea
                  rows={8}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here — the more detail, the better the tailoring…"
                  className="mt-1"
                />
              </Field>

              <Button
                onClick={handleTailor}
                disabled={tailoring || !selectedCVId || !jobDescription.trim()}
                className="w-full bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow"
              >
                {tailoring
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Tailoring with Gemini…</>
                  : <><Sparkles className="mr-2 h-4 w-4" /> Tailor with AI</>}
              </Button>
            </TabsContent>

            {/* ── Parser ── */}
            <TabsContent value="parser" className="space-y-4">
              <div className="rounded-xl border border-dashed border-border p-4 text-center">
                <FileUp className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Paste your existing CV text</p>
                <p className="text-xs text-muted-foreground">Gemini will extract and structure all your information automatically.</p>
              </div>
              <Textarea
                rows={10}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste your full CV here — work history, education, skills, everything…"
              />
              <Button
                onClick={handleParse}
                disabled={parsing || !rawText.trim()}
                className="w-full bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0"
              >
                {parsing
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Parsing with Gemini…</>
                  : <><Sparkles className="mr-2 h-4 w-4" /> Parse with AI</>}
              </Button>
            </TabsContent>
          </div>
        </Tabs>
      </Card>

      {/* Preview */}
      <Card className="glass overflow-y-auto border-border p-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold">{cv.profile.name || "Your Name"}</h1>
          <p className="text-primary">{cv.profile.title || "Your Title"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {cv.profile.email} {cv.profile.phone && `• ${cv.profile.phone}`}
          </p>
          {cv.profile.summary && (
            <p className="mt-4 text-sm leading-relaxed text-foreground/90">{cv.profile.summary}</p>
          )}

          <Section title="Experience">
            {cv.experiences.filter((e) => e.role || e.company).map((e, i) => (
              <div key={i} className="mb-4">
                <div className="flex justify-between">
                  <span className="font-medium">{e.role} <span className="text-muted-foreground">· {e.company}</span></span>
                  <span className="text-xs text-muted-foreground">{e.period}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-foreground/80">{e.bullets}</p>
              </div>
            ))}
          </Section>

          <Section title="Education">
            {cv.education.filter((e) => e.degree || e.school).map((e, i) => (
              <div key={i} className="mb-2 flex justify-between text-sm">
                <span><span className="font-medium">{e.degree}</span> · {e.school}</span>
                <span className="text-muted-foreground">{e.year}</span>
              </div>
            ))}
          </Section>

          {cv.skills && (
            <Section title="Skills">
              <div className="flex flex-wrap gap-1.5">
                {cv.skills.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
                  <span key={s} className="rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs">{s}</span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 border-b border-border pb-1 text-xs font-semibold uppercase tracking-widest text-primary">{title}</h2>
      {children}
    </section>
  );
}
