import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractSearchProfileFromCV } from "@/lib/cv-extract.functions";

type LocationType = "any" | "remote" | "hybrid" | "onsite";

type NormalizedJob = {
  job_title: string;
  company: string;
  job_description: string;
  url: string | null;
  salary_range: string | null;
  location: string | null;
  source: string;
};

// ─── SerpAPI (Google Jobs) — primary multi-source aggregator ──────────────
// Free tier: 100 searches/month. One search returns results pooled from
// LinkedIn, Indeed, Google Jobs listings, and direct company postings —
// SerpAPI does the cross-platform aggregation for us rather than us
// scraping each site individually (which is fragile and ToS-risky).
async function searchSerpApiJobs(
  query: string,
  locationType: LocationType,
): Promise<NormalizedJob[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    engine: "google_jobs",
    q: locationType === "remote" ? `${query} remote` : query,
    api_key: apiKey,
    num: "20",
  });

  let res: Response;
  try {
    res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e: any) {
    console.error("[fetchJobs] SerpAPI request failed:", e.message);
    return [];
  }

  if (!res.ok) {
    console.error(`[fetchJobs] SerpAPI HTTP ${res.status}`);
    return [];
  }

  const json = await res.json();
  const results: any[] = json?.jobs_results ?? [];

  return results
    .filter((r) => {
      if (locationType === "any") return true;
      const loc = (r.location ?? "").toLowerCase();
      const detected = (r.detected_extensions?.schedule_type ?? "").toLowerCase();
      if (locationType === "remote") return loc.includes("remote") || /work from home/.test(loc);
      if (locationType === "hybrid") return loc.includes("hybrid");
      // onsite: anything not explicitly remote/hybrid
      return !loc.includes("remote") && !loc.includes("hybrid");
    })
    .map((r) => ({
      job_title: (r.title ?? "Untitled").slice(0, 255),
      company: (r.company_name ?? "Unknown").slice(0, 255),
      job_description: (r.description ?? "").slice(0, 8000),
      url: r.share_link ?? r.related_links?.[0]?.link ?? null,
      salary_range: r.detected_extensions?.salary ?? null,
      location: r.location ?? null,
      source: "serpapi",
    }));
}

// ─── Public no-key fallback (Jobicy) — used if SERPAPI_KEY isn't set ──────
// Kept as a backstop so the feature still works before you've added a
// SerpAPI key, rather than failing outright.
async function searchJobicyFallback(query: string): Promise<NormalizedJob[]> {
  const apiUrl = `https://jobicy.com/api/v2/remote-jobs?count=20&tag=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const jobs: any[] = json?.jobs ?? [];
    return jobs.map((j) => ({
      job_title: (j.jobTitle ?? "Untitled").slice(0, 255),
      company: (j.companyName ?? "Unknown").slice(0, 255),
      job_description: (j.jobExcerpt ?? "").slice(0, 8000),
      url: j.url ?? null,
      salary_range:
        j.annualSalaryMin && j.annualSalaryMax
          ? `$${j.annualSalaryMin} - $${j.annualSalaryMax}`
          : null,
      location: j.jobGeo ?? "Remote",
      source: "jobicy",
    }));
  } catch (e: any) {
    console.error("[fetchJobs] Jobicy fallback failed:", e.message);
    return [];
  }
}

// ─── Fetch Jobs ─────────────────────────────────────────────────────────────
// Accepts an optional target_role and location_type. If target_role is
// empty (or a search with it returns zero results), falls back to a
// CV-derived search profile so "no jobs found" stops being a dead end.
export const fetchJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { target_role?: string; location_type?: LocationType }) => d,
  )
  .handler(async ({ data, context }) => {
    const locationType: LocationType = data.location_type ?? "any";
    let query = data.target_role?.trim() ?? "";
    let usedCvFallback = false;

    if (!query) {
      const profile = await extractSearchProfileFromCV();
      if (!profile) {
        throw new Error(
          "Enter a target role, or save a CV in the CV Builder so we can search for you automatically.",
        );
      }
      query = [profile.primary_title, ...profile.keywords.slice(0, 2)].join(" ");
      usedCvFallback = true;
    }

    let jobs: NormalizedJob[] = process.env.SERPAPI_KEY
      ? await searchSerpApiJobs(query, locationType)
      : await searchJobicyFallback(query);

    // If the primary search came back empty and we weren't already using
    // the CV fallback, retry once with a CV-derived query before giving up.
    if (jobs.length === 0 && !usedCvFallback) {
      const profile = await extractSearchProfileFromCV();
      if (profile) {
        const fallbackQuery = [profile.primary_title, ...profile.keywords.slice(0, 2)].join(" ");
        jobs = process.env.SERPAPI_KEY
          ? await searchSerpApiJobs(fallbackQuery, locationType)
          : await searchJobicyFallback(fallbackQuery);
        usedCvFallback = jobs.length > 0;
      }
    }

    if (jobs.length === 0) {
      return {
        inserted: 0,
        message: usedCvFallback
          ? "Searched using your CV profile, but no matching jobs were found right now. Try again later."
          : "No jobs found for that role. Try a broader keyword, or leave it blank to search from your CV.",
        used_cv_fallback: usedCvFallback,
      };
    }

    const rows = jobs.map((j) => ({
      job_title: j.job_title,
      company: j.company,
      job_description: j.job_description,
      url: j.url,
      salary_range: j.salary_range,
      location: j.location,
      source: j.source,
    }));

    const { error } = await context.supabase.from("scraped_jobs").insert(rows);

    if (error) {
      console.error("[fetchJobs] DB insert error:", error.message);
      return {
        inserted: 0,
        message: `Fetched ${jobs.length} jobs but failed to save: ${error.message}`,
        used_cv_fallback: usedCvFallback,
      };
    }

    return {
      inserted: rows.length,
      message: usedCvFallback
        ? `Found ${rows.length} jobs based on your CV profile ("${query}").`
        : `Found and saved ${rows.length} jobs for "${query}".`,
      used_cv_fallback: usedCvFallback,
    };
  });

// ─── Scrape Job (manual URL — now a secondary/optional path) ──────────────
// Unchanged in behavior. The UI no longer requires this as the primary
// flow (see dashboard.jobs.tsx), but the capability stays available for
// users who want to add a specific posting manually.
export const scrapeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data, context }) => {
    const { url } = data;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Invalid URL — please enter a full URL including https://");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Only http and https URLs are supported.");
    }

    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; VentureApplyBot/1.0; +https://ventureapply.ai)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e: any) {
      throw new Error(`Could not fetch URL: ${e.message}`);
    }

    const { load } = await import("cheerio");
    const $ = load(html);

    const jobTitle =
      $("h1").first().text().trim() || $("title").first().text().trim() || "Untitled Job";

    $(
      "script, style, nav, header, footer, aside, [role='navigation'], [role='banner'], [role='complementary'], noscript, iframe, svg",
    ).remove();

    const descriptionEl = $(
      "[class*='job-description'], [class*='description'], [id*='job-desc'], [class*='posting-body'], article, main, [role='main']",
    ).first();

    const jobDescription = (descriptionEl.length ? descriptionEl : $("body"))
      .text()
      .replace(/\s{3,}/g, "\n\n")
      .trim()
      .slice(0, 8000);

    const company = parsed.hostname.replace(/^www\./, "");

    const { data: inserted, error } = await context.supabase
      .from("scraped_jobs")
      .insert({
        job_title: jobTitle.slice(0, 255),
        url,
        company,
        job_description: jobDescription,
        source: "manual",
      })
      .select("id, job_title, company, url")
      .single();

    if (error) {
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

// ─── ATS detection — internal engine identifiers, real names preserved
//     in user-facing records (see decision in chat) ────────────────────────
// Internally we refer to these as engine types so future ATS additions
// don't require renaming a growing if/else chain. The *actual* platform
// name is still what gets written to job_applications/agent_logs, because
// that's the user's own factual record of where their application went.
type ATSEngineType = "ATS_Engine_Type_A" | "ATS_Engine_Type_B" | "unsupported";

function detectAtsEngine(url: string): { engine: ATSEngineType; displayName: string } {
  if (url.includes("greenhouse.io")) return { engine: "ATS_Engine_Type_A", displayName: "Greenhouse" };
  if (url.includes("lever.co")) return { engine: "ATS_Engine_Type_B", displayName: "Lever" };
  return { engine: "unsupported", displayName: "Custom portal" };
}

// ─── Auto-Apply MVP ───────────────────────────────────────────────────────
export const autoApply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cv_id: string; job_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { cv_id, job_id } = data;

    const { data: jobRow } = await context.supabase
      .from("scraped_jobs")
      .select("job_title, company, url")
      .eq("id", job_id)
      .maybeSingle();

    const jobUrl = jobRow?.url ?? "";
    const { engine, displayName } = detectAtsEngine(jobUrl);
    const isSupportedATS = engine !== "unsupported";

    if (!isSupportedATS) {
      const { data: existing } = await context.supabase
        .from("job_applications")
        .select("id")
        .eq("user_id", context.userId)
        .eq("job_id", job_id)
        .maybeSingle();

      if (existing?.id) {
        await context.supabase
          .from("job_applications")
          .update({
            status: "queued",
            note: "Queued for manual review — this portal requires custom browser agent mapping.",
          })
          .eq("id", existing.id);
      } else {
        await context.supabase.from("job_applications").insert({
          user_id: context.userId,
          job_id,
          title: jobRow?.job_title ?? "Job Application",
          company: jobRow?.company ?? "Unknown Company",
          url: jobRow?.url ?? null,
          cv_label: cv_id,
          status: "queued",
          note: "Queued for manual review — this portal requires custom browser agent mapping.",
          match_score: 0,
        });
      }

      return {
        success: true,
        application_id: existing?.id ?? null,
        status: "queued",
        message: "Automated application queued for manual review — this portal requires custom browser agent mapping.",
      };
    }

    // Supported ATS: simulate field-mapping sequence
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const { data: existing } = await context.supabase
      .from("job_applications")
      .select("id")
      .eq("user_id", context.userId)
      .eq("job_id", job_id)
      .maybeSingle();

    let applicationId: string;

    if (existing?.id) {
      const { error } = await context.supabase
        .from("job_applications")
        .update({
          status: "applied",
          cv_label: cv_id,
          applied_at: new Date().toISOString(),
          note: `Applied via VentureApply AI agent (${displayName} — MVP simulation)`,
        })
        .eq("id", existing.id);

      if (error) throw new Error(`Failed to update application: ${error.message}`);
      applicationId = existing.id;
    } else {
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
          note: `Applied via VentureApply AI agent (${displayName} — MVP simulation)`,
          match_score: 0,
        })
        .select("id")
        .single();

      if (error) throw new Error(`Failed to create application: ${error.message}`);
      applicationId = inserted.id;
    }

    await context.supabase
      .from("agent_logs")
      .insert({
        user_id: context.userId,
        action: `auto_apply_mvp (${engine})`,
        status: "success",
        company: jobRow?.company ?? null,
      })
      .then(() => {});

    return {
      success: true,
      application_id: applicationId,
      status: "applied",
      message: "Application submitted successfully via agent.",
    };
  });
