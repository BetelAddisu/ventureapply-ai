import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Eye,
  Loader2,
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";
import { CVRenderer, cvBuilderToResumeData } from "@/components/cv-templates";
import type { TemplateId } from "@/components/cv-templates";

export const Route = createFileRoute("/_authenticated/dashboard/resumes")({
  component: ResumeVault,
});

function ResumeVault() {
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResume, setSelectedResume] = useState<any | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateId>("minimalist");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("cvs")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      
      // Normalize data with fallbacks for null/undefined values
      const normalizedData = (data || []).map((cv: any) => ({
        id: cv.id || crypto.randomUUID(),
        title: cv.title || "Untitled Resume",
        content: cv.content || cv.raw_json_data || {},
        created_at: cv.created_at || new Date().toISOString(),
        updated_at: cv.updated_at || new Date().toISOString(),
      }));
      
      setResumes(normalizedData);
    } catch (err: any) {
      console.error("Failed to load resumes:", err);
      setError(err.message || "Failed to load resumes");
      toast.error("Failed to load resumes");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this resume?")) return;

    const { error } = await supabase.from("cvs").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete resume");
    } else {
      setResumes(resumes.filter(r => r.id !== id));
      if (selectedResume?.id === id) {
        setSelectedResume(null);
        setShowPreview(false);
      }
      toast.success("Resume deleted");
    }
  };

  const handleExportPDF = async (resume: any) => {
    if (!resume) {
      toast.error("No resume selected");
      return;
    }

    const { jsPDF } = await import("jspdf");
    const { default: html2canvas } = await import("html2canvas");

    toast.info("Generating PDF...");

    try {
      // Build clean HTML for the selected template
      const cvContent = resume.content || resume.raw_json_data || {};
      const cleanHTML = buildCleanHTMLForExport(cvContent, previewTemplate);

      // Create iframe for PDF generation
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:absolute;left:-9999px;top:0;width:794px;height:1123px;border:none;";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Could not access iframe");

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html><head><style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { width: 794px; height: 1123px; background: #fff; font-family: Arial, sans-serif; }
        </style></head><body>${cleanHTML}</body></html>
      `);
      iframeDoc.close();

      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(iframeDoc.body, {
        scale: 2,
        backgroundColor: "#ffffff",
        width: 794,
        height: 1123,
        logging: false,
      });

      document.body.removeChild(iframe);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width * ratio, canvas.height * ratio);

      const filename = `${resume.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      pdf.save(filename);
      toast.success("PDF exported!");
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error(`Export failed: ${err.message}`);
    }
  };

  const previewResume = (resume: any) => {
    setSelectedResume(resume);
    setShowPreview(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="border-destructive/50 p-8 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={fetchResumes}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Console</p>
          <h1 className="text-3xl font-semibold">Resume Vault</h1>
          <p className="text-sm text-muted-foreground">Manage and export your resume versions</p>
        </div>
        <Link to="/dashboard/cv-builder">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create New Resume
          </Button>
        </Link>
      </div>

      {resumes.length === 0 ? (
        <Card className="glass border-border p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No resumes yet</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Create your first resume or import one from a file
          </p>
          <Link to="/dashboard/cv-builder">
            <Button className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create Resume
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <Card key={resume.id} className="glass border-border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{resume.title || "Untitled Resume"}</h3>
                    <p className="text-xs text-muted-foreground">
                      Updated {resume.updated_at ? new Date(resume.updated_at).toLocaleDateString() : "Recently"}
                    </p>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => previewResume(resume)}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(resume.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>
                {selectedResume?.title || "Resume Preview"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                <Select value={previewTemplate} onValueChange={(v) => setPreviewTemplate(v as TemplateId)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimalist">Minimalist</SelectItem>
                    <SelectItem value="creative">Creative</SelectItem>
                    <SelectItem value="executive">Executive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto bg-gray-100 p-4 rounded-lg">
            {selectedResume && (
              <div className="bg-white shadow-lg mx-auto" style={{ maxWidth: "794px" }}>
                <CVRenderer
                  templateId={previewTemplate}
                  resumeData={cvBuilderToResumeData(selectedResume.content)}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            {selectedResume && (
              <Button onClick={() => handleExportPDF(selectedResume)}>
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Simplified HTML generator for export (matching cv-builder.tsx patterns)
function buildCleanHTMLForExport(cv: any, templateId: TemplateId): string {
  const data = cvBuilderToResumeData(cv || {});
  const { basics, work, education, skills } = data;
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

function buildMinimalistHTML({ name, label, email, phone, summary, work, education, skills }: any) {
  const workHTML = work.map((job: any) => `
    <div style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between;">
        <strong>${job.position || job.name || ""}</strong>
        <span style="color: #666; font-size: 12px;">${job.startDate || ""}${job.endDate ? " – " + job.endDate : ""}</span>
      </div>
      <div style="color: #666; font-size: 13px;">${job.company || ""}</div>
      ${job.highlights?.map((h: string) => `<li style="margin-left: 16px; color: #333; font-size: 13px;">${h}</li>`).join("") || ""}
    </div>
  `).join("");

  const eduHTML = education.map((edu: any) => `
    <div style="margin-bottom: 12px;">
      <strong>${edu.studyType || ""}${edu.area ? " in " + edu.area : ""}</strong>
      <div style="color: #666; font-size: 13px;">${edu.institution || ""} - ${edu.endDate || ""}</div>
    </div>
  `).join("");

  const skillsHTML = skills.map((s: any) => `
    <span style="display: inline-block; padding: 2px 8px; background: #f0f0f0; color: #333; font-size: 12px; border-radius: 4px; margin: 2px;">
      ${typeof s === "string" ? s : s.name || ""}
    </span>
  `).join("");

  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111; background: #fff; padding: 20px;">
      <header style="border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 20px;">
        <h1 style="font-size: 28px; font-weight: bold; margin: 0;">${name}</h1>
        ${label ? `<p style="font-size: 16px; color: #444; margin: 4px 0;">${label}</p>` : ""}
        <div style="font-size: 13px; color: #555; margin-top: 8px;">${email}${phone ? " • " + phone : ""}</div>
      </header>
      ${summary ? `<section style="margin-bottom: 20px;"><h2 style="font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Summary</h2><p style="color: #333; font-size: 13px; line-height: 1.5;">${summary}</p></section>` : ""}
      ${workHTML ? `<section style="margin-bottom: 20px;"><h2 style="font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Experience</h2>${workHTML}</section>` : ""}
      ${eduHTML ? `<section style="margin-bottom: 20px;"><h2 style="font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Education</h2>${eduHTML}</section>` : ""}
      ${skillsHTML ? `<section><h2 style="font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Skills</h2><div style="margin-top: 8px;">${skillsHTML}</div></section>` : ""}
    </div>
  `;
}

function buildCreativeHTML({ name, label, email, phone, summary, work, education, skills }: any) {
  const workHTML = work.map((job: any) => `
    <div style="margin-bottom: 16px;">
      <strong>${job.position || job.name || ""}</strong> at ${job.company || ""}
      <div style="color: #666; font-size: 12px;">${job.startDate || ""} - ${job.endDate || ""}</div>
      ${job.highlights?.map((h: string) => `<div style="font-size: 12px; padding-left: 12px;">• ${h}</div>`).join("") || ""}
    </div>
  `).join("");

  return `
    <div style="display: flex; font-family: Arial, sans-serif; background: #fff;">
      <aside style="width: 200px; background: #1e293b; color: #fff; padding: 24px;">
        <h1 style="font-size: 20px; font-weight: bold;">${name}</h1>
        ${label ? `<p style="font-size: 11px; color: #94a3b8;">${label}</p>` : ""}
        <div style="margin-top: 20px; font-size: 11px;">
          <div>${email}</div>
          <div>${phone}</div>
        </div>
        ${skills?.length ? `<div style="margin-top: 20px;"><h3 style="font-size: 10px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #334155; padding-bottom: 4px;">Skills</h3><div style="margin-top: 8px; font-size: 11px;">${skills.map((s: any) => `<div>${typeof s === "string" ? s : s.name || ""}</div>`).join("")}</div></div>` : ""}
      </aside>
      <main style="flex: 1; padding: 24px;">
        ${summary ? `<section style="margin-bottom: 20px;"><h2 style="font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #d97706; padding-bottom: 4px; display: inline-block;">Profile</h2><p style="color: #333; font-size: 12px;">${summary}</p></section>` : ""}
        ${workHTML ? `<section><h2 style="font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #d97706; padding-bottom: 4px; display: inline-block;">Experience</h2>${workHTML}</section>` : ""}
      </main>
    </div>
  `;
}

function buildExecutiveHTML({ name, label, email, phone, summary, work, education, skills }: any) {
  const workHTML = work.map((job: any) => `
    <div style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin-bottom: 6px;">
        <div><strong>${job.position || job.name || ""}</strong> - ${job.company || ""}</div>
        <span style="color: #666; font-size: 12px;">${job.startDate || ""} - ${job.endDate || ""}</span>
      </div>
      ${job.highlights?.map((h: string) => `<li style="font-size: 12px; margin-left: 20px; color: #333;">${h}</li>`).join("") || ""}
    </div>
  `).join("");

  return `
    <div style="font-family: Georgia, serif; font-size: 14px; color: #222; background: #fff; padding: 30px;">
      <header style="text-align: center; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 24px;">
        <h1 style="font-size: 32px; font-weight: bold; letter-spacing: 2px; margin: 0;">${name}</h1>
        ${label ? `<p style="font-size: 16px; color: #555; font-style: italic; margin: 8px 0;">${label}</p>` : ""}
        <div style="color: #555; font-size: 12px; margin-top: 12px;">${email}${phone ? " | " + phone : ""}</div>
      </header>
      ${summary ? `<section style="text-align: center; margin-bottom: 24px;"><p style="color: #444; max-width: 600px; margin: 0 auto; line-height: 1.6; font-size: 13px;">${summary}</p></section>` : ""}
      ${workHTML ? `<section style="margin-bottom: 24px;"><h2 style="font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 16px;">Professional Experience</h2>${workHTML}</section>` : ""}
      <div style="display: flex; gap: 30px;">
        ${education?.length ? `<section style="flex: 1;"><h2 style="font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 12px;">Education</h2>${education.map((e: any) => `<div style="margin-bottom: 8px;"><strong>${e.studyType || ""}</strong><div style="color: #666; font-size: 12px; font-style: italic;">${e.institution || ""}</div></div>`).join("")}</section>` : ""}
        ${skills?.length ? `<section style="flex: 1;"><h2 style="font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 12px;">Core Competencies</h2>${skills.map((s: any) => `<div style="font-size: 12px; margin-bottom: 4px;"><strong>${typeof s === "string" ? s : s.name || ""}</strong></div>`).join("")}</section>` : ""}
      </div>
    </div>
  `;
}
