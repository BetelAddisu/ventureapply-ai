import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── Scrape Job ───────────────────────────────────────────────────────────────
// Accepts a public job posting URL, fetches its HTML server-side (bypassing
// CORS), then uses cheerio to extract the page title and main body text.

export const scrapeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data, context }) => {
    const { url } = data;

    // Basic URL validation
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Invalid URL — please enter a full URL including https://");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Only http and https URLs are supported.");
    }

    // Fetch the page HTML
    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; VentureApplyBot/1.0; +https://ventureapply.ai)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e: any) {
      throw new Error(`Could not fetch URL: ${e.message}`);
    }

    // Parse with cheerio (server-side only)
    const { load } = await import("cheerio");
    const $ = load(html);

    // Extract title
    const jobTitle =
      $("h1").first().text().trim() ||
      $("title").first().text().trim() ||
      "Untitled Job";

    // Remove noisy tags before extracting body text
    $(
      "script, style, nav, header, footer, aside, [role='navigation'], [role='banner'], [role='complementary'], noscript, iframe, svg"
    ).remove();

    // Try common job-description containers first, fall back to <body>
    const descriptionEl =
      $("[class*='job-description'], [class*='description'], [id*='job-desc'], [class*='posting-body'], article, main, [role='main']").first();

    const jobDescription = (descriptionEl.length ? descriptionEl : $("body"))
      .text()
      .replace(/\s{3,}/g, "\n\n")
      .trim()
      .slice(0, 8000);

    const company = parsed.hostname.replace(/^www\./, "");

    // Save to scraped_jobs table using the real column names: job_title, job_description
    const { data: inserted, error } = await context.supabase
      .from("scraped_jobs")
      .insert({
        job_title: jobTitle.slice(0, 255),
        url,
        company,
        job_description: jobDescription,
      })
      .select("id, job_title, company, url")
      .single();

    if (error) {
      // Non-fatal — return the scraped data even if DB insert fails
      console.error("[scrapeJob] DB insert failed:", error.message);
      return { id: null, title: jobTitle, description: jobDescription, url, company };
    }

    return {
      id: inserted.id,
      title: inserted.job_title,
      company: inserted.company,
      description: jobDescription,
      url: inserted.url,
    };
  });

// ─── Auto-Apply MVP ───────────────────────────────────────────────────────────
// Accepts a CV id and a job id. Simulates browser automation with a 3-second
// delay, then upserts an application row in job_applications as 'applied'.

export const autoApply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cv_id: string; job_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { cv_id, job_id } = data;

    // Simulate browser automation processing time (3 seconds)
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Fetch job details so we can populate required fields (title, company)
    const { data: jobRow } = await context.supabase
      .from("scraped_jobs")
      .select("job_title, company, url")
      .eq("id", job_id)
      .maybeSingle();

    // Check if there is already an application row for this job
    const { data: existing } = await context.supabase
      .from("job_applications")
      .select("id")
      .eq("user_id", context.userId)
      .eq("job_id", job_id)
      .maybeSingle();

    let applicationId: string;

    if (existing?.id) {
      // Update existing row to 'applied'
      const { error } = await context.supabase
        .from("job_applications")
        .update({
          status: "applied",
          cv_label: cv_id,
          applied_at: new Date().toISOString(),
          note: "Applied via VentureApply AI agent (MVP simulation)",
        })
        .eq("id", existing.id);

      if (error) throw new Error(`Failed to update application: ${error.message}`);
      applicationId = existing.id;
    } else {
      // Insert a new application row — required fields: title, company, user_id
      const { data: inserted, error } = await context.supabase
        .from("job_applications")
        .insert({
          user_id: context.userId,
          job_id,
          title: jobRow?.job_title ?? "Job Application",
          company: jobRow?.company ?? "Unknown Company",
          url: jobRow?.url ?? null,
          cv_label: cv_id,
          status: "applied",
          applied_at: new Date().toISOString(),
          note: "Applied via VentureApply AI agent (MVP simulation)",
          match_score: 0,
        })
        .select("id")
        .single();

      if (error) throw new Error(`Failed to create application: ${error.message}`);
      applicationId = inserted.id;
    }

    // Log to agent_logs — fire-and-forget, non-critical
    await context.supabase.from("agent_logs").insert({
      user_id: context.userId,
      action: "auto_apply_mvp",
      status: "success",
      company: jobRow?.company ?? null,
    }).then(() => {});

    return {
      success: true,
      application_id: applicationId,
      status: "applied",
      message: "Application submitted successfully via agent.",
    };
  });
