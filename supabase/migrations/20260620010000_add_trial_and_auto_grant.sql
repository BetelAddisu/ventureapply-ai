-- ============================================================
-- Auto-grant a 6-month "scale" (Premium Agent) trial to every
-- new signup, fully server-side. Does NOT touch or weaken the
-- existing trg_profiles_protect_tier trigger — that trigger only
-- blocks CLIENT writes to current_tier; this migration's writes
-- happen inside SECURITY DEFINER functions (treated as server-role),
-- which the trigger already permits.
-- ============================================================

-- ─── Trial tracking columns ────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_tier text DEFAULT 'scale';

COMMENT ON COLUMN public.profiles.trial_ends_at IS
  'When the auto-granted signup trial expires. NULL = no trial (e.g. downgraded already, or pre-trial-era account).';
COMMENT ON COLUMN public.profiles.trial_tier IS
  'The tier the trial grants access to while trial_ends_at is in the future.';

-- ─── Update handle_new_user(): grant trial on signup ───────────────────────
-- This function already runs as SECURITY DEFINER (owner-level privileges),
-- which is what the tier-protection trigger treats as an authorized write.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, current_tier, trial_tier, trial_ends_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    'scale',
    'scale',
    now() + interval '6 months'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── Downgrade function: flips expired trials back to 'free' ──────────────
-- Called from a server function (service-role context), never from the
-- client directly. Safe to call repeatedly / on every authenticated request.
CREATE OR REPLACE FUNCTION public.expire_trial_if_needed(p_user_id uuid)
RETURNS TABLE (current_tier text, trial_ends_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
     SET current_tier = 'free'
   WHERE id = p_user_id
     AND trial_ends_at IS NOT NULL
     AND trial_ends_at <= now()
     AND current_tier <> 'free';

  RETURN QUERY
    SELECT p.current_tier, p.trial_ends_at
    FROM public.profiles p
    WHERE p.id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_trial_if_needed(uuid) FROM PUBLIC, anon, authenticated;
-- Server functions call this via the service-role admin client, so no
-- explicit GRANT to authenticated is needed (service_role bypasses grants).
