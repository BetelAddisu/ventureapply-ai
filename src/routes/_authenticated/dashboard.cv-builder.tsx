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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  Save,
  Loader2,
  Trash2,
  Sparkles,
  FileUp,
  Download,
  X,
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";
import { parseCV, listCVs } from "@/lib/cv.functions";
import { useCVCache } from "@/hooks/use-cv-cache";
import { CVRenderer, cvBuilderToResumeData } from "@/components/cv-templates";
import type { TemplateId } from "@/components/cv-templates";

export const Route = createFileRoute("/_authenticated/dashboard/cv-builder")({
  component: CVBuilder,
});

type Experience = {
  role: string;
  company: string;
  period: string;
  bullets: string;
};
type Education = { degree: string; school: string; year: string };
type CV = {
  profile: {
    name: string;
    title: string;
    email: string;
    phone: string;
    summary: string;
  };
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
  const [templateId, setTemplateId] = useState<TemplateId>("minimalist");

  // Import-from-file modal state
  const [importOpen, setImportOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFn = useServerFn(parseCV);
  const listFn = useServerFn(listCVs);

  // Use CV cache for persistent parsed data
  const { cachedCV, cachedTitle, isLoading: cacheLoading, saveToCache, getCacheAge, hasValidCache } = useCVCache();

  // Load saved CV on mount - prioritize cache, then Supabase
  useEffect(() => {
    (async () => {
      // First check if we have cached data from a recent parse
      if (hasValidCache && cachedCV) {
        setCV(cachedCV);
        setTitle(cachedTitle);
        return;
      }

      // Otherwise load from Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("cvs")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setTitle(data.title);
        const raw = data.raw_json_data as any;
        if (raw?.profile) setCV(raw as CV);
      }
    })();
  }, [cachedCV, cachedTitle, hasValidCache]);

  const save = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("cvs")
      .upsert(
        { user_id: user.id, title, raw_json_data: cv as any },
        { onConflict: "user_id,title" as any },
      );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("CV saved");
    // Refresh list silently
    try {
      await listFn();
    } catch {
      /* non-critical */
    }
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
      } else if (
        file.type === "application/pdf" ||
        file.name.endsWith(".pdf")
      ) {
        // PDF: use pdfjs-dist (loaded dynamically to keep bundle lean)
        const pdfjsLib = await import("pdfjs-dist");

        // Use a stable, standard .js CDN URL — avoids dynamic .mjs import failures
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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
        toast.success(
          `PDF extracted (${pdf.numPages} page${pdf.numPages !== 1 ? "s" : ""}) — review and click Parse`,
        );
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
    if (!extractedText.trim())
      return toast.error("No text to parse — upload a file first.");
    setParsing(true);
    try {
      const parsed = await parseFn({ data: { raw_text: extractedText } });
      setCV(parsed as CV);
      // Save to cache for persistence
      await saveToCache(parsed as CV, title);
      setExtractedText("");
      setImportOpen(false);
      toast.success("CV imported — review the fields then Save.");
      setActiveTab("profile");
    } catch (e: any) {
      toast.error(e.message ?? "Parsing failed — please try again.");
    } finally {
      setParsing(false);
    }
  };

  // ── Export as PDF using html2canvas + jspdf ─────────────────────────────────
  const handleExport = async () => {
    const previewEl = document.getElementById("cv-render-area");
    if (!previewEl) {
      toast.error("Could not find CV preview to export.");
      return;
    }

    toast.info("Generating PDF…");
    
    try {
      const { jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");

      // Build clean HTML with only hex/rgb colors
      const resumeData = cvBuilderToResumeData(cv);
      const cleanHTML = buildCleanHTML(resumeData, templateId);

      // Create an off-screen container with clean HTML
      const container = document.createElement("div");
      container.innerHTML = cleanHTML;
      container.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 794px;
        background: #ffffff;
        padding: 40px;
        font-family: system-ui, -apple-system, sans-serif;
      `;
      document.body.appendChild(container);

      // Wait for fonts to load
      await new Promise(resolve => setTimeout(resolve, 200));

      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, "PNG", imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      const filename = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_CV.pdf`;
      pdf.save(filename);
      
      toast.success("CV exported successfully!");
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error(`Export failed: ${err.message}`);
    }
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
              Upload a <strong>.pdf</strong> or <strong>.txt</strong> file. Text
              is extracted in your browser and then AI will structure it
              into your CV fields.
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
                  {extracting
                    ? "Extracting text…"
                    : "Click or drag a file here"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports PDF and TXT
                </p>
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
                {parsing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Parsing with AI…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Parse with AI
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div
        id="cv-editor-layout"
        className="grid h-[calc(100vh-7rem)] gap-4 lg:grid-cols-2"
      >
        {/* ── Editor panel ── */}
        <Card
          id="cv-editor"
          className="glass flex flex-col overflow-hidden border-border"
        >
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
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="m-3 grid grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="experience">Experience</TabsTrigger>
              <TabsTrigger value="education">Education</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-4 pt-0">
              {/* ── Profile ── */}
              <TabsContent value="profile" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name">
                    <Input
                      value={cv.profile.name}
                      onChange={(e) => updateProfile("name", e.target.value)}
                    />
                  </Field>
                  <Field label="Title">
                    <Input
                      value={cv.profile.title}
                      onChange={(e) => updateProfile("title", e.target.value)}
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      value={cv.profile.email}
                      onChange={(e) => updateProfile("email", e.target.value)}
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      value={cv.profile.phone}
                      onChange={(e) => updateProfile("phone", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Summary">
                  <Textarea
                    rows={4}
                    value={cv.profile.summary}
                    onChange={(e) => updateProfile("summary", e.target.value)}
                  />
                </Field>
                <Field label="Skills (comma-separated)">
                  <Textarea
                    rows={2}
                    value={cv.skills}
                    onChange={(e) => setCV({ ...cv, skills: e.target.value })}
                    placeholder="React, TypeScript, Node…"
                  />
                </Field>
              </TabsContent>

              {/* ── Experience ── */}
              <TabsContent value="experience" className="space-y-4">
                {cv.experiences.map((exp, i) => (
                  <Card key={i} className="border-border bg-card/40 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Role"
                        value={exp.role}
                        onChange={(e) => {
                          const a = [...cv.experiences];
                          a[i].role = e.target.value;
                          setCV({ ...cv, experiences: a });
                        }}
                      />
                      <Input
                        placeholder="Company"
                        value={exp.company}
                        onChange={(e) => {
                          const a = [...cv.experiences];
                          a[i].company = e.target.value;
                          setCV({ ...cv, experiences: a });
                        }}
                      />
                    </div>
                    <Input
                      className="mt-2"
                      placeholder="Period (e.g. 2022 — Present)"
                      value={exp.period}
                      onChange={(e) => {
                        const a = [...cv.experiences];
                        a[i].period = e.target.value;
                        setCV({ ...cv, experiences: a });
                      }}
                    />
                    <Textarea
                      className="mt-2"
                      rows={3}
                      placeholder="• Led … • Shipped …"
                      value={exp.bullets}
                      onChange={(e) => {
                        const a = [...cv.experiences];
                        a[i].bullets = e.target.value;
                        setCV({ ...cv, experiences: a });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-destructive"
                      onClick={() =>
                        setCV({
                          ...cv,
                          experiences: cv.experiences.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCV({
                      ...cv,
                      experiences: [
                        ...cv.experiences,
                        { role: "", company: "", period: "", bullets: "" },
                      ],
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Add experience
                </Button>
              </TabsContent>

              {/* ── Education ── */}
              <TabsContent value="education" className="space-y-4">
                {cv.education.map((ed, i) => (
                  <Card key={i} className="border-border bg-card/40 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Degree"
                        value={ed.degree}
                        onChange={(e) => {
                          const a = [...cv.education];
                          a[i].degree = e.target.value;
                          setCV({ ...cv, education: a });
                        }}
                      />
                      <Input
                        placeholder="School"
                        value={ed.school}
                        onChange={(e) => {
                          const a = [...cv.education];
                          a[i].school = e.target.value;
                          setCV({ ...cv, education: a });
                        }}
                      />
                    </div>
                    <Input
                      className="mt-2"
                      placeholder="Year"
                      value={ed.year}
                      onChange={(e) => {
                        const a = [...cv.education];
                        a[i].year = e.target.value;
                        setCV({ ...cv, education: a });
                      }}
                    />
                  </Card>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCV({
                      ...cv,
                      education: [
                        ...cv.education,
                        { degree: "", school: "", year: "" },
                      ],
                    })
                  }
                >
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
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
              <Select value={templateId} onValueChange={(v) => setTemplateId(v as TemplateId)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimalist">Minimalist</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/dashboard/tailor">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-primary border-primary/40 hover:bg-primary/10"
                >
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

          {/* CV Theme Preview */}
          <div id="cv-render-area" className="p-4 bg-white">
            <CVRenderer templateId={templateId} resumeData={cvBuilderToResumeData(cv)} />
          </div>
        </Card>
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 border-b border-border pb-1 text-xs font-semibold uppercase tracking-widest text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ── Clean HTML Generator for PDF Export ─────────────────────────────────────
// Generates self-contained HTML with only hex/rgb colors to avoid oklch issues
function buildCleanHTML(resumeData: ReturnType<typeof cvBuilderToResumeData>, templateId: TemplateId): string {
  const { basics, work, education, skills } = resumeData;
  const name = basics?.name || "Your Name";
  const label = basics?.label || "";
  const email = basics?.email || "";
  const phone = basics?.phone || "";
  const summary = basics?.summary || "";

  if (templateId === "executive") {
    return buildExecutiveHTML({ name, label, email, phone, summary, work: work || [], education: education || [], skills: skills || [] });
  } else if (templateId === "creative") {
    return buildCreativeHTML({ name, label, email, phone, summary, work: work || [], education: education || [], skills: skills || [] });
  }
  return buildMinimalistHTML({ name, label, email, phone, summary, work: work || [], education: education || [], skills: skills || [] });
}

function buildMinimalistHTML({ name, label, email, phone, summary, work, education, skills }: {
  name: string; label: string; email: string; phone: string; summary: string;
  work: any[]; education: any[]; skills: any[];
}): string {
  const workHTML = work.map(job => `
    <div style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between;">
        <strong>${job.position || job.name || ""}</strong>
        <span style="color: #666; font-size: 12px;">${job.startDate || ""}${job.endDate ? " – " + job.endDate : ""}</span>
      </div>
      <div style="color: #666; font-size: 13px;">${job.company || ""}</div>
      ${job.highlights?.map((h: string) => `<li style="margin-left: 16px; color: #333; font-size: 13px;">${h}</li>`).join("") || ""}
    </div>
  `).join("");

  const eduHTML = education.map(edu => `
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between;">
        <strong>${edu.studyType || ""}${edu.area ? " in " + edu.area : ""}</strong>
        <span style="color: #666; font-size: 12px;">${edu.endDate || ""}</span>
      </div>
      <div style="color: #666; font-size: 13px;">${edu.institution || ""}</div>
    </div>
  `).join("");

  const skillsHTML = skills.map(s => `
    <span style="display: inline-block; padding: 2px 8px; background: #f0f0f0; color: #333; font-size: 12px; border-radius: 4px; margin: 2px;">
      ${typeof s === "string" ? s : s.name || ""}
    </span>
  `).join("");

  return `
    <div style="font-family: system-ui, sans-serif; font-size: 14px; color: #111; background: #fff; padding: 20px;">
      <header style="border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 20px;">
        <h1 style="font-size: 28px; font-weight: bold; margin: 0;">${name}</h1>
        ${label ? `<p style="font-size: 16px; color: #444; margin: 4px 0;">${label}</p>` : ""}
        <div style="font-size: 13px; color: #555; margin-top: 8px;">
          ${email}${phone ? " • " + phone : ""}
        </div>
      </header>
      ${summary ? `<section style="margin-bottom: 20px;"><h2 style="font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Summary</h2><p style="color: #333; font-size: 13px; line-height: 1.5;">${summary}</p></section>` : ""}
      ${workHTML ? `<section style="margin-bottom: 20px;"><h2 style="font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Experience</h2>${workHTML}</section>` : ""}
      ${eduHTML ? `<section style="margin-bottom: 20px;"><h2 style="font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Education</h2>${eduHTML}</section>` : ""}
      ${skillsHTML ? `<section><h2 style="font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Skills</h2><div style="margin-top: 8px;">${skillsHTML}</div></section>` : ""}
    </div>
  `;
}

function buildCreativeHTML({ name, label, email, phone, summary, work, education, skills }: {
  name: string; label: string; email: string; phone: string; summary: string;
  work: any[]; education: any[]; skills: any[];
}): string {
  const skillsHTML = skills.map(s => `
    <div style="margin-bottom: 12px;">
      <div style="color: #fff; font-size: 13px; font-weight: 500;">${typeof s === "string" ? s : s.name || ""}</div>
    </div>
  `).join("");

  const eduHTML = education.map(edu => `
    <div style="margin-bottom: 12px;">
      <div style="color: #fff; font-size: 13px; font-weight: 500;">${edu.studyType || ""}</div>
      <div style="color: #94a3b8; font-size: 11px;">${edu.institution || ""}</div>
      <div style="color: #64748b; font-size: 11px;">${edu.endDate || ""}</div>
    </div>
  `).join("");

  const workHTML = work.map(job => `
    <div style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between;">
        <strong style="color: #111;">${job.position || job.name || ""}</strong>
        <span style="color: #666; font-size: 11px;">${job.startDate || ""}${job.endDate ? " – " + job.endDate : ""}</span>
      </div>
      <div style="color: #d97706; font-size: 13px; font-weight: 500;">${job.company || ""}</div>
      ${job.highlights?.map((h: string) => `<div style="color: #333; font-size: 12px; padding-left: 12px; border-left: 2px solid #d97706; margin-top: 4px;">${h}</div>`).join("") || ""}
    </div>
  `).join("");

  return `
    <div style="display: flex; font-family: system-ui, sans-serif; background: #fff;">
      <aside style="width: 200px; background: linear-gradient(to bottom, #1e293b, #0f172a); color: #fff; padding: 24px;">
        <h1 style="font-size: 20px; font-weight: bold; margin: 0 0 4px 0;">${name}</h1>
        ${label ? `<p style="font-size: 11px; color: #94a3b8; margin: 0;">${label}</p>` : ""}
        <div style="margin-top: 20px;">
          <h3 style="font-size: 10px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #334155; padding-bottom: 4px;">Contact</h3>
          <div style="font-size: 11px; color: #cbd5e1; margin-top: 8px;">
            ${email}<br>${phone}
          </div>
        </div>
        ${skillsHTML ? `<div style="margin-top: 20px;"><h3 style="font-size: 10px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #334155; padding-bottom: 4px;">Skills</h3><div style="margin-top: 8px;">${skillsHTML}</div></div>` : ""}
        ${eduHTML ? `<div style="margin-top: 20px;"><h3 style="font-size: 10px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #334155; padding-bottom: 4px;">Education</h3><div style="margin-top: 8px;">${eduHTML}</div></div>` : ""}
      </aside>
      <main style="flex: 1; padding: 24px;">
        ${summary ? `<section style="margin-bottom: 20px;"><h2 style="font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #d97706; padding-bottom: 4px; display: inline-block;">Profile</h2><p style="color: #333; font-size: 12px; line-height: 1.5;">${summary}</p></section>` : ""}
        ${workHTML ? `<section><h2 style="font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #d97706; padding-bottom: 4px; display: inline-block;">Experience</h2>${workHTML}</section>` : ""}
      </main>
    </div>
  `;
}

function buildExecutiveHTML({ name, label, email, phone, summary, work, education, skills }: {
  name: string; label: string; email: string; phone: string; summary: string;
  work: any[]; education: any[]; skills: any[];
}): string {
  const workHTML = work.map(job => `
    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; margin-bottom: 8px;">
        <div>
          <strong style="font-size: 15px;">${job.position || job.name || ""}</strong>
          <em style="color: #666; font-size: 13px;"> - ${job.company || ""}</em>
        </div>
        <span style="color: #666; font-size: 12px;">${job.startDate || ""}${job.endDate ? " – " + job.endDate : ""}</span>
      </div>
      ${job.highlights?.map((h: string) => `<li style="color: #333; font-size: 12px; margin-left: 20px;">${h}</li>`).join("") || ""}
    </div>
  `).join("");

  const eduHTML = education.map(edu => `
    <div style="margin-bottom: 12px;">
      <strong style="color: #111; font-size: 13px;">${edu.studyType || ""}${edu.area ? " in " + edu.area : ""}</strong>
      <div style="color: #666; font-size: 12px; font-style: italic;">${edu.institution || ""}</div>
      <div style="color: #888; font-size: 11px;">${edu.endDate || ""}</div>
    </div>
  `).join("");

  const skillsHTML = skills.map(s => `
    <div style="font-size: 12px; margin-bottom: 4px;">
      <strong style="color: #111;">${typeof s === "string" ? s : s.name || ""}</strong>
      ${s.keywords?.length ? `<div style="color: #666; font-size: 11px;">${s.keywords.join(" • ")}</div>` : ""}
    </div>
  `).join("");

  return `
    <div style="font-family: Georgia, serif; font-size: 14px; color: #222; background: #fff; padding: 30px;">
      <header style="text-align: center; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 24px;">
        <h1 style="font-size: 32px; font-weight: bold; letter-spacing: 2px; margin: 0;">${name}</h1>
        ${label ? `<p style="font-size: 16px; color: #555; font-style: italic; margin: 8px 0;">${label}</p>` : ""}
        <div style="color: #555; font-size: 12px; margin-top: 12px;">
          ${email}${phone ? " | " + phone : ""}
        </div>
      </header>
      ${summary ? `<section style="text-align: center; margin-bottom: 24px;"><p style="color: #444; max-width: 600px; margin: 0 auto; line-height: 1.6; font-size: 13px;">${summary}</p></section>` : ""}
      ${workHTML ? `<section style="margin-bottom: 24px;"><h2 style="font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 16px;">Professional Experience</h2>${workHTML}</section>` : ""}
      <div style="display: flex; gap: 30px;">
        ${eduHTML ? `<section style="flex: 1;"><h2 style="font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 12px;">Education</h2>${eduHTML}</section>` : ""}
        ${skillsHTML ? `<section style="flex: 1;"><h2 style="font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 12px;">Core Competencies</h2>${skillsHTML}</section>` : ""}
      </div>
    </div>
  `;
}
