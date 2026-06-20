-- Adds search_urgency column to profiles and source column to scraped_jobs.
-- Identical schema changes applied to align supabase database with frontend mutations.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS search_urgency text;
COMMENT ON COLUMN public.profiles.search_urgency IS
  'How urgently the user is looking for a job (e.g., active, open, exploring).';

ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
COMMENT ON COLUMN public.scraped_jobs.source IS
  'The source of the job listing (e.g., serpapi, jobicy, manual).';
