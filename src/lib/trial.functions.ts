import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ExpireTrialRpcRow = {
  current_tier: string | null;
  trial_ends_at: string | null;
};

// ─── Get trial / tier status for the current user ─────────────────────────
// Reads with the RLS-scoped client (context.supabase), so this never needs
// elevated privileges — it only ever sees the caller's own row.
export const getTrialStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("current_tier, trial_tier, trial_ends_at")
      .eq("id", context.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const trialEndsAt = data?.trial_ends_at ?? null;
    const isTrialActive = Boolean(
      trialEndsAt && new Date(trialEndsAt).getTime() > Date.now(),
    );

    return {
      current_tier: data?.current_tier ?? "free",
      trial_tier: data?.trial_tier ?? "scale",
      trial_ends_at: trialEndsAt,
      is_trial_active: isTrialActive,
    };
  });

// ─── Expire trial if needed (idempotent, safe to call often) ──────────────
// This is the only place current_tier gets written outside of the signup
// trigger. It runs through supabaseAdmin (service role), which is exactly
// what trg_profiles_protect_tier is designed to allow — the trigger still
// blocks any attempt to set current_tier from a plain client mutation.
export const expireTrialIfNeeded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (supabaseAdmin as any).rpc("expire_trial_if_needed", {
      p_user_id: context.userId,
    }) as {
      data: ExpireTrialRpcRow[] | ExpireTrialRpcRow | null;
      error: { message: string } | null;
    };

    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    return {
      current_tier: row?.current_tier ?? "free",
      trial_ends_at: row?.trial_ends_at ?? null,
    };
  });
