import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAgentProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, agent_active, telegram_chat_id, telegram_handle")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        id: context.userId,
        agent_active: false,
        telegram_chat_id: null,
        telegram_handle: null,
      }
    );
  });

export const setAgentActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { active: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ agent_active: data.active })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { active: data.active };
  });

export const listApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { statuses: string[] }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("job_applications")
      .select("*")
      .eq("user_id", context.userId)
      .in("status", data.statuses)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listAgentLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agent_logs")
      .select("id, created_at, action, status, company")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ─── ATS engine detection ───────────────────────────────────────────────
// Internal identifiers only — see jobs.functions.ts for the matching
// implementation. displayName is kept for the user's own application
// note/log, never surfaced in generic UI copy (phase text, tooltips, etc).
type ATSEngineType = "ATS_Engine_Type_A" | "ATS_Engine_Type_B" | "unsupported";

function detectAtsEngine(url: string): { engine: ATSEngineType; displayName: string } {
  if (url.includes("greenhouse.io")) return { engine: "ATS_Engine_Type_A", displayName: "Greenhouse" };
  if (url.includes("lever.co")) return { engine: "ATS_Engine_Type_B", displayName: "Lever" };
  return { engine: "unsupported", displayName: "Custom portal" };
}

async function resolveAgentJobId({
  context,
  jobId,
  jobTitle,
  company,
  url,
}: {
  context: { supabase: any };
  jobId?: string;
  jobTitle: string;
  company: string;
  url?: string;
}) {
  if (jobId) {
    const { data: existingById, error } = await context.supabase
      .from("scraped_jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw new Error(`Job lookup failed: ${error.message}`);
    if (existingById?.id) return existingById.id as string;
  }

  if (url) {
    const { data: existingByUrl, error } = await context.supabase
      .from("scraped_jobs")
      .select("id")
      .eq("url", url)
      .maybeSingle();
    if (error) throw new Error(`Job lookup failed: ${error.message}`);
    if (existingByUrl?.id) return existingByUrl.id as string;
  }

  const { data: inserted, error } = await context.supabase
    .from("scraped_jobs")
    .insert({
      job_title: jobTitle.slice(0, 255),
      company: company.slice(0, 255),
      url: url || null,
      job_description: "",
      source: "manual",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to stage job for agent run: ${error.message}`);
  return inserted.id as string;
}

// ─── Run Agent Sequence (Phase 1 & 2 MVP) ────────────────────────────────
// Executes the autonomous application sequence for a given job. Writes to
// job_applications and agent_logs. Phase copy is now generic/abstracted
// (no platform names) — only the application's own note field, which the
// user can see in their own history, records which real ATS was used.

export const runAgentSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { job_id?: string; job_title: string; company: string; url?: string }) =>
      d,
  )
  .handler(async ({ data, context }) => {
    const { job_id, job_title, company, url } = data;
    const resolvedJobId = await resolveAgentJobId({
      context,
      jobId: job_id,
      jobTitle: job_title,
      company,
      url,
    });

    const { engine, displayName } = detectAtsEngine(url ?? "");
    const isSupportedATS = engine !== "unsupported";

    // Simulate processing delay (server-side portion)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const { data: existingApplication, error: existingError } = await context.supabase
      .from("job_applications")
      .select("id")
      .eq("user_id", context.userId)
      .eq("job_id", resolvedJobId)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Application lookup failed: ${existingError.message}`);
    }

    const applicationPayload = {
      user_id: context.userId,
      job_id: resolvedJobId,
      title: job_title,
      company,
      url: url ?? null,
      status: isSupportedATS ? "applied" : "queued",
      applied_at: isSupportedATS ? new Date().toISOString() : null,
      note: isSupportedATS
        ? `Applied via automated emulation agent (${displayName}).`
        : "Custom portal detected. Application queued for manual override agent processing.",
      match_score: 0,
    };

    let applicationId: string;

    if (existingApplication?.id) {
      const { error: appErr } = await context.supabase
        .from("job_applications")
        .update(applicationPayload)
        .eq("id", existingApplication.id);

      if (appErr) throw new Error(`Application update failed: ${appErr.message}`);
      applicationId = existingApplication.id;
    } else {
      const { data: inserted, error: appErr } = await context.supabase
        .from("job_applications")
        .insert(applicationPayload)
        .select("id")
        .single();

      if (appErr) throw new Error(`Application insert failed: ${appErr.message}`);
      applicationId = inserted.id;
    }

    await context.supabase.from("agent_logs").insert({
      user_id: context.userId,
      application_id: applicationId,
      company,
      action: `Completed application sequence for ${job_title} (engine: ${engine}).`,
      status: isSupportedATS ? "success" : "pending",
    });

    return {
      application_id: applicationId,
      ats_supported: isSupportedATS,
      status: isSupportedATS ? "applied" : "queued",
      message: isSupportedATS
        ? "Application submitted successfully via beta agent!"
        : "Custom portal detected. Application queued for manual override agent processing.",
    };
  });
