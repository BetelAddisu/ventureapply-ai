-- Fix RLS on scraped_jobs to allow users to update jobs they search for
-- Enable RLS if not already
ALTER TABLE scraped_jobs ENABLE ROW LEVEL SECURITY;

-- Allow users to SELECT all jobs (for Discover tab)
DROP POLICY IF EXISTS "Users can view all jobs" ON scraped_jobs;
CREATE POLICY "Users can view all jobs" ON scraped_jobs
  FOR SELECT USING (true);

-- Allow users to INSERT jobs
DROP POLICY IF EXISTS "Users can insert jobs" ON scraped_jobs;
CREATE POLICY "Users can insert jobs" ON scraped_jobs
  FOR INSERT WITH CHECK (true);

-- Allow users to UPDATE jobs (to set their searched_by_user_id)
DROP POLICY IF EXISTS "Users can update jobs" ON scraped_jobs;
CREATE POLICY "Users can update jobs" ON scraped_jobs
  FOR UPDATE USING (true) WITH CHECK (true);

-- Allow users to see their own scanned jobs
DROP POLICY IF EXISTS "Users can view own scanned jobs" ON scraped_jobs;
CREATE POLICY "Users can view own scanned jobs" ON scraped_jobs
  FOR SELECT USING (searched_by_user_id = auth.uid());
