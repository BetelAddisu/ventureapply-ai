import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus, Save, Loader2, Trash2, Sparkles, FileUp, Download, X,
} from "lucide-react";
import { toast } from "sonner";
import { parseCV, listCVs } from "@/lib/cv.functions";

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

  // Import-from-file modal state
  const [importOpen, setImportOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Refresh list silently
    try { await listFn(); } catch { /* non-critical */ }
  };

  // ── PDF / TXT extraction (client-side, no server call) ────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    setExtractedText("");

    try {
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        // Plain text: read directly
        const text = await file.text();
        setExtractedText(text);
        toast.success("Text extracted — review and click Parse");
      } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        // PDF: use pdfjs-dist (loaded dynamically to keep bundle lean)
        const pdfjsLib = await import("pdfjs-dist");

        // Use the legacy build worker via CDN — avoids bundler worker issues
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item: any) => ("str" in item ? item.str : ""))
            .join(" ")
            .replace(/\s{2,}/g, "\n");
          pages.push(pageText);
        }
        setExtractedText(pages.join("\n\n"));
        toast.success(`PDF extracted (${pdf.numPages} page${pdf.numPages !== 1 ? "s" : ""}) — review and click Parse`);
      } else {
        toast.error("Only .pdf and .txt files are supported.");
      }
    } catch (err: any) {
      toast.error(`Extraction failed: ${err.message}`);
    } finally {
      setExtracting(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleParse = async () => {
    if (!extractedText.trim()) return toast.error("No text to parse — upload a file first.");
    setParsing(true);
    try {
      const parsed = await parseFn({ data: { raw_text: extractedText } });
      setCV(parsed as CV);
      setExtractedText("");
      setImportOpen(false);
      toast.success("CV imported — review the fields then Save.");
      setActiveTab("profile");
    } catch (e: any) {
      toast.error(e.message ?? "Parsing failed");
    } finally {
      setParsing(false);
    }
  };

  // ── Export as PDF (window.print with print CSS) ───────────────────────────
  const handleExport = () => {
    window.print();
  };

  const updateProfile = (k: keyof CV["profile"], v: string) =>
    setCV({ ...cv, profile: { ...cv.profile, [k]: v } });

  return (
    <>
      {/* ── Import from File Modal ── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-primary" />
              Import CV from File
            </DialogTitle>
            <DialogDescription>
              Upload a <strong>.pdf</strong> or <strong>.txt</strong> file. Text is extracted in your
              browser and then Gemini will structure it into your CV fields.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Drop zone */}
            <label
              htmlFor="cv-file-input"
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 transition hover:border-primary/60 hover:bg-primary/5"
            >
              {extracting ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <FileUp className="h-8 w-8 text-muted-foreground" />
              )}
              <div className="text-center">
                <p className="text-sm font-medium">
                  {extracting ? "Extracting text…" : "Click or drag a file here"}
                </p>
                <p className="text-xs text-muted-foreground">Supports PDF and TXT</p>
              </div>
              <input
                id="cv-file-input"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                className="hidden"
                onChange={handleFileChange}
                disabled={extracting}
              />
            </label>

            {/* Extracted text preview / edit */}
            {extractedText && (
              <div className="relative">
                <Textarea
                  rows={8}
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  className="text-xs"
                  placeholder="Extracted text will appear here…"
                />
                <button
                  onClick={() => setExtractedText("")}
                  className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground"
                  title="Clear text"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleParse}
                disabled={parsing || extracting || !extractedText.trim()}
                className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0"
              >
                {parsing
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Parsing with Gemini…</>
                  : <><Sparkles className="mr-2 h-4 w-4" />Parse with AI</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div id="cv-editor-layout" className="grid h-[calc(100vh-7rem)] gap-4 lg:grid-cols-2">
        {/* ── Editor panel ── */}
        <Card id="cv-editor" className="glass flex flex-col overflow-hidden border-border">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex-1">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-0 bg-transparent text-lg font-semibold focus-visible:ring-0"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportOpen(true)}
                className="hidden sm:flex"
              >
                <FileUp className="mr-1.5 h-4 w-4" />
                Import
              </Button>
              <Button
                onClick={save}
                disabled={saving}
                size="sm"
                className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save</>}
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="m-3 grid grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="experience">Experience</TabsTrigger>
              <TabsTrigger value="education">Education</TabsTrigger>
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

            </div>
          </Tabs>
        </Card>

        {/* ── Preview panel ── */}
        <Card id="cv-preview" className="glass overflow-y-auto border-border">
          {/* Preview toolbar */}
          <div className="no-print flex items-center justify-between border-b border-border px-6 py-3">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Preview</span>
            <div className="flex items-center gap-2">
              <Link to="/dashboard/tailor">
                <Button variant="outline" size="sm" className="text-primary border-primary/40 hover:bg-primary/10">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Tailor for a Job
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                title="Export CV as PDF"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export PDF
              </Button>
            </div>
          </div>

          <div className="p-8">
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
          </div>
        </Card>
      </div>
    </>
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
