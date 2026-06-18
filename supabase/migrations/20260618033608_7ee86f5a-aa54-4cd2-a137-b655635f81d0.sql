
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agent_active boolean NOT NULL DEFAULT false;

CREATE TABLE public.job_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.scraped_jobs(id) ON DELETE SET NULL,
  title text NOT NULL,
  company text NOT NULL,
  location text,
  salary text,
  url text,
  cv_label text,
  match_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued',
  note text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own job_applications" ON public.job_applications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER job_applications_set_updated_at BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_job_applications_user_status ON public.job_applications (user_id, status, updated_at DESC);

CREATE TABLE public.agent_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.job_applications(id) ON DELETE SET NULL,
  company text,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_logs TO authenticated;
GRANT ALL ON public.agent_logs TO service_role;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own agent_logs" ON public.agent_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_agent_logs_user_created ON public.agent_logs (user_id, created_at DESC);
