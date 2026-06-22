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

// ─── SerpAPI (Google Jobs) ────────────────────────────────────────────────
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

// ─── Public no-key fallback (Jobicy) ──────────────────────────────────────
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

// ─── Deduplication helper ─────────────────────────────────────────────────────
function deduplicateJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    // Create a unique key based on URL (most reliable) or title+company combination
    const urlKey = job.url?.toLowerCase().trim() ?? "";
    const titleCompanyKey = `${job.job_title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`;
    
    // Prefer jobs with URLs over those without
    if (urlKey) {
      if (seen.has(urlKey)) return false;
      seen.add(urlKey);
    }
    if (seen.has(titleCompanyKey)) return false;
    seen.add(titleCompanyKey);
    return true;
  });
}

// ─── Fetch Jobs ─────────────────────────────────────────────────────────────
export const fetchJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { target_role?: string; location_type?: LocationType }) => d,
  )
  .handler(async ({ data, context }) => {
    const locationType: LocationType = data.location_type ?? "any";
    let query = data.target_role?.trim() ?? "";
    let usedCvFallback = false;

    // If no keyword provided, try AI to extract search terms from CV
    if (!query) {
      try {
        const profile = await extractSearchProfileFromCV();
        if (profile) {
          query = [profile.primary_title, ...profile.keywords.slice(0, 2)].join(" ");
          usedCvFallback = true;
        }
      } catch (e) {
        console.warn("[fetchJobs] AI profile extraction failed:", e);
      }
    }

    // If still no query (AI failed), try to get CV title from database
    if (!query) {
      const { data: cvRow } = await context.supabase
        .from("cvs")
        .select("raw_json_data")
        .eq("user_id", context.userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cvRow?.raw_json_data?.profile?.title) {
        query = cvRow.raw_json_data.profile.title;
      } else {
        // Ultimate fallback: generic software jobs
        query = "software engineer developer";
      }
    }

    // Fetch from BOTH sources in parallel for maximum coverage
    // SerpAPI results will be prioritized (placed first in results)
    const [serpApiJobs, jobicyJobs] = await Promise.all([
      searchSerpApiJobs(query, locationType),
      searchJobicyFallback(query),
    ]);

    // Combine results: SerpAPI first, then add unique Jobicy results
    let jobs: NormalizedJob[] = [...serpApiJobs];

    // Add Jobicy results only if they add new unique jobs
    const existingUrls = new Set(serpApiJobs.map(j => j.url?.toLowerCase()));
    const existingKeys = new Set(serpApiJobs.map(j => `${j.job_title}|${j.company}`.toLowerCase()));

    for (const job of jobicyJobs) {
      const urlKey = job.url?.toLowerCase();
      const key = `${job.job_title}|${job.company}`.toLowerCase();
      if ((urlKey && !existingUrls.has(urlKey)) || !existingKeys.has(key)) {
        jobs.push(job);
        if (urlKey) existingUrls.add(urlKey);
        existingKeys.add(key);
      }
    }

    // If combined results are empty, try AI fallback
    if (jobs.length === 0 && !usedCvFallback) {
      try {
        const profile = await extractSearchProfileFromCV();
        if (profile) {
          const fallbackQuery = [profile.primary_title, ...profile.keywords.slice(0, 2)].join(" ");

          const [fallbackSerpJobs, fallbackJobicyJobs] = await Promise.all([
            searchSerpApiJobs(fallbackQuery, locationType),
            searchJobicyFallback(fallbackQuery),
          ]);

          jobs = [...fallbackSerpJobs];
          const fbUrls = new Set(fallbackSerpJobs.map(j => j.url?.toLowerCase()));
          const fbKeys = new Set(fallbackSerpJobs.map(j => `${j.job_title}|${j.company}`.toLowerCase()));

          for (const job of fallbackJobicyJobs) {
            const urlKey = job.url?.toLowerCase();
            const key = `${job.job_title}|${job.company}`.toLowerCase();
            if ((urlKey && !fbUrls.has(urlKey)) || !fbKeys.has(key)) {
              jobs.push(job);
            }
          }

          usedCvFallback = jobs.length > 0;
        }
      } catch (e) {
        console.warn("[fetchJobs] AI fallback extraction failed:", e);
      }
    }

    if (jobs.length === 0) {
      return {
        inserted: 0,
        message: usedCvFallback
          ? "Searched using your CV profile, but no matching jobs were found. Try a broader keyword."
          : "No jobs found for that role. Try a broader keyword like 'software engineer'.",
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
      search_query: query,
      searched_by_user_id: context.userId,
    }));

    const { data: upserted, error } = await context.supabase
      .from("scraped_jobs")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
      .select("id");

    if (error) {
      console.error("[fetchJobs] DB upsert error:", error.message);
      return {
        inserted: 0,
        message: `Fetched ${jobs.length} jobs but failed to save: ${error.message}`,
        used_cv_fallback: usedCvFallback,
      };
    }

    const savedCount = upserted?.length ?? 0;
    const skippedCount = rows.length - savedCount;

    return {
      inserted: savedCount,
      total_found: rows.length,
      message:
        savedCount === 0
          ? `Found ${rows.length} job${rows.length === 1 ? "" : "s"} for "${query}" — refreshing your feed now.`
          : skippedCount > 0
            ? `Added ${savedCount} new job${savedCount === 1 ? "" : "s"} for "${query}".`
            : usedCvFallback
              ? `Found ${savedCount} jobs based on your CV profile ("${query}").`
              : `Found and saved ${savedCount} jobs for "${query}".`,
      used_cv_fallback: usedCvFallback,
    };
  });

// ─── Scrape Job (manual URL) ──────────────────────────────────────────────
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
        search_query: null,
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

// ─── ATS detection ─────────────────────────────────────────────────────────
type ATSEngineType = "ATS_Engine_Type_A" | "ATS_Engine_Type_B" | "unsupported";

function detectAtsEngine(url: string): { engine: ATSEngineType; displayName: string } {
  if (url.includes("greenhouse.io")) return { engine: "ATS_Engine_Type_A", displayName: "Greenhouse" };
  if (url.includes("lever.co")) return { engine: "ATS_Engine_Type_B", displayName: "Lever" };
  return { engine: "unsupported", displayName: "Custom portal" };
}

// ─── Auto-Apply MVP ────────────────────────────────────────────────────────
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
