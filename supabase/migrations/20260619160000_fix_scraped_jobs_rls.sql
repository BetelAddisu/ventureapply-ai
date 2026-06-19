-- Fix: scraped_jobs only had a SELECT policy, blocking user-driven inserts from the job scraper.

-- Safely drop existing read-only restriction
DROP POLICY IF EXISTS "Authenticated can read jobs" ON public.scraped_jobs;

-- Create a global read policy for users and matches
CREATE POLICY "Enable read access for all authenticated users"
  ON public.scraped_jobs FOR SELECT USING (true);

-- Create an explicit insert policy allowing scraping operations to write jobs
CREATE POLICY "Enable insert access for scraping operations"
  ON public.scraped_jobs FOR INSERT WITH CHECK (true);

-- Also grant INSERT permission to the authenticated role (was only SELECT before)
GRANT INSERT ON public.scraped_jobs TO authenticated;
