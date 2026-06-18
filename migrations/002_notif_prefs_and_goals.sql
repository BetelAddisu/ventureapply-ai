-- ============================================================
-- VentureApply AI — Migration 002
-- Adds notification prefs + job search goal fields to profiles
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Notification channel preferences (persists Jobs page toggles)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_email     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_telegram  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_whatsapp  boolean NOT NULL DEFAULT false;

-- 2. Job search goal fields (feeds agent matching criteria)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_role      text,
  ADD COLUMN IF NOT EXISTS search_urgency   text  -- 'active' | 'open' | 'exploring'
    CHECK (search_urgency IN ('active', 'open', 'exploring'));

-- 3. scraped_jobs — ensure status column exists for job tracker badge
ALTER TABLE public.scraped_jobs
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'new';

-- ============================================================
-- Verify
-- ============================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('notify_email','notify_telegram','notify_whatsapp','target_role','search_urgency');
