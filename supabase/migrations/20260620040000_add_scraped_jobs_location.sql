-- Adds a location column to scraped_jobs so the on-site/hybrid/remote
-- filter introduced in fetchJobs has somewhere to store/display results.
-- Purely additive — no existing policies, grants, or triggers touched.

ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS location text;

COMMENT ON COLUMN public.scraped_jobs.location IS
  'Free-text location/work-type string from the source (e.g. "Remote", "Hybrid - Austin, TX").';
