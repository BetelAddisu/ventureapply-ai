import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── Match Jobs to CV ───────────────────────────────────────────────────────
// Scores every scraped_jobs row that doesn't yet have a job_matches row for
// (this user, this job) against the chosen CV, using Gemini. Writes results
// into job_matches. Designed to be called both automatically after a scan
// and manually via a "Find My Matches" button — either way it only scores
// jobs it hasn't scored yet for this user, so re-running is cheap.

type CV = {
  profile: { name: string; title: string; email: string; phone: string; summary: string };
  experiences: { role: string; company: string; period: string; bullets: string }[];
  education: { degree: string; school: string; year: string }[];
  skills: string;
};

type MatchResult = { match_score: number; tailor_suggestions: string };

const MAX_JOBS_PER_RUN = 25; // keeps a single call bounded and fast
const CONCURRENCY = 4; // small concurrency cap so we don't hammer Gemini serially or all-at-once

async function callGemini(prompt: string, systemInstruction: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const json = await res.json();
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

function cvToText(cv: CV): string {
  return [
    cv.profile?.title,
    cv.profile?.summary,
    ...(cv.experiences ?? []).map((e) => `${e.role} at ${e.company}: ${e.bullets}`),
    cv.skills,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 10_000);
}

async function scoreOneJob(cvText: string, jobTitle: string, jobDescription: string): Promise<MatchResult> {
  const systemInstruction = `You are a recruiter scoring how well a candidate's CV fits a job posting.
Return ONLY a valid JSON object, no markdown, no backticks, no preamble.
Shape: { "match_score": <integer 0-100>, "tailor_suggestions": "<one concise sentence, max 25 words, on the single biggest tweak to improve fit>" }
Score based on overlap in skills, seniority, and domain. Be realistic — most CVs are not a 90+ fit.`;

  const prompt = `JOB TITLE: ${jobTitle}\n\nJOB DESCRIPTION:\n${jobDescription.slice(0, 4000)}\n\nCANDIDATE CV:\n${cvText}`;

  const raw = await callGemini(prompt, systemInstruction);
  const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    const parsed = JSON.parse(clean) as MatchResult;
    const score = Math.max(0, Math.min(100, Math.round(parsed.match_score)));
    return { match_score: score, tailor_suggestions: parsed.tailor_suggestions ?? "" };
  } catch {
    // If Gemini returns something unparsable for one job, don't fail the whole
    // batch — just skip this job with a neutral score.
    return { match_score: 0, tailor_suggestions: "" };
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function runNext(): Promise<void> {
    const i = next++;
    if (i >= items.length) return;
    results[i] = await worker(items[i]);
    return runNext();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

export const matchJobsToCV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cv_id: string }) => d)
  .handler(async ({ data, context }) => {
    // 1. Load the chosen CV
    const { data: cvRow, error: cvError } = await context.supabase
      .from("cvs")
      .select("raw_json_data")
      .eq("id", data.cv_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (cvError) throw new Error(cvError.message);
    if (!cvRow) throw new Error("CV not found.");

    const cvText = cvToText(cvRow.raw_json_data as CV);
    if (!cvText.trim()) {
      throw new Error("That CV looks empty — add some details in the CV Builder first.");
    }

    // 2. Find jobs that don't yet have a match row for this user
    const { data: existingMatches, error: matchesErr } = await context.supabase
      .from("job_matches")
      .select("job_id")
      .eq("user_id", context.userId);
    if (matchesErr) throw new Error(matchesErr.message);

    const alreadyMatchedJobIds = new Set((existingMatches ?? []).map((m) => m.job_id));

    const { data: jobs, error: jobsErr } = await context.supabase
      .from("scraped_jobs")
      .select("id, job_title, job_description")
      .order("created_at", { ascending: false })
      .limit(100);
    if (jobsErr) throw new Error(jobsErr.message);

    const candidates = (jobs ?? [])
      .filter((j) => !alreadyMatchedJobIds.has(j.id))
      .slice(0, MAX_JOBS_PER_RUN);

    if (candidates.length === 0) {
      return { scored: 0, message: "No new jobs to match — you're all caught up." };
    }

    // 3. Score each candidate job with bounded concurrency
    const scores = await runWithConcurrency(candidates, CONCURRENCY, (job) =>
      scoreOneJob(cvText, job.job_title, job.job_description ?? ""),
    );

    // 4. Write results into job_matches
    const rows = candidates.map((job, i) => ({
      user_id: context.userId,
      job_id: job.id,
      cv_id: data.cv_id,
      match_score: scores[i].match_score,
      tailor_suggestions: scores[i].tailor_suggestions,
      status: "matched",
    }));

    const { error: insertErr } = await context.supabase.from("job_matches").insert(rows);
    if (insertErr) throw new Error(`Saved scores but failed to write matches: ${insertErr.message}`);

    return {
      scored: rows.length,
      message: `Scored ${rows.length} job${rows.length === 1 ? "" : "s"} against your CV.`,
    };
  });
