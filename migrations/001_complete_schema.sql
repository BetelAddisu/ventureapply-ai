-- ============================================================
-- VentureApply AI — Migration 001 (Run FIRST in Supabase SQL Editor)
-- Complete schema: all tables, RLS, indexes
-- ============================================================

-- ─── Enable UUID extension ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             text,
  target_title          text,
  experience_level      text CHECK (experience_level IN ('entry','mid','senior','lead','executive')),
  current_tier          text NOT NULL DEFAULT 'free'
                          CHECK (current_tier IN ('free','pro','scale')),
  notification_preference text,
  telegram_chat_id      text,
  -- notification channel toggles (Migration 002 adds these, kept here for fresh installs)
  notify_email          boolean NOT NULL DEFAULT true,
  notify_telegram       boolean NOT NULL DEFAULT false,
  notify_whatsapp       boolean NOT NULL DEFAULT false,
  -- job search goal (Migration 002)
  target_role           text,
  search_urgency        text CHECK (search_urgency IN ('active','open','exploring')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── cvs ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cvs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'My Resume',
  raw_json_data   jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title)
);

ALTER TABLE public.cvs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own CVs"
  ON public.cvs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS cvs_user_id_idx ON public.cvs(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER cvs_updated_at BEFORE UPDATE ON public.cvs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── scraped_jobs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scraped_jobs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_title       text NOT NULL,
  company         text NOT NULL,
  job_description text,
  salary_range    text,
  location        text,
  url             text,
  source          text,                          -- e.g. 'linkedin', 'indeed'
  status          text NOT NULL DEFAULT 'new',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scraped_jobs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read scraped jobs (they're global)
CREATE POLICY "Authenticated users can read scraped jobs"
  ON public.scraped_jobs FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS scraped_jobs_created_at_idx ON public.scraped_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS scraped_jobs_status_idx ON public.scraped_jobs(status);

-- ─── job_matches ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_matches (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id              uuid NOT NULL REFERENCES public.scraped_jobs(id) ON DELETE CASCADE,
  cv_id               uuid REFERENCES public.cvs(id) ON DELETE SET NULL,
  match_score         integer CHECK (match_score BETWEEN 0 AND 100),
  tailor_suggestions  text,
  status              text NOT NULL DEFAULT 'matched'
                        CHECK (status IN ('matched','tailored','applied_via_agent','rejected')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own job matches"
  ON public.job_matches FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS job_matches_user_id_idx ON public.job_matches(user_id);
CREATE INDEX IF NOT EXISTS job_matches_status_idx ON public.job_matches(status);

CREATE TRIGGER job_matches_updated_at BEFORE UPDATE ON public.job_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── job_applications ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_applications (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id          uuid REFERENCES public.scraped_jobs(id) ON DELETE SET NULL,
  cv_id           uuid REFERENCES public.cvs(id) ON DELETE SET NULL,
  company         text,
  job_title       text,
  applied_at      timestamptz NOT NULL DEFAULT now(),
  method          text NOT NULL DEFAULT 'agent' CHECK (method IN ('agent','manual')),
  status          text NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted','viewed','interview','offer','rejected'))
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own applications"
  ON public.job_applications FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS job_applications_user_id_idx ON public.job_applications(user_id);

-- ─── agent_logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message     text NOT NULL,
  level       text NOT NULL DEFAULT 'info' CHECK (level IN ('info','success','warn','error')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agent logs"
  ON public.agent_logs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS agent_logs_user_id_created_idx ON public.agent_logs(user_id, created_at DESC);

-- ─── Seed: sample scraped jobs (so Jobs page isn't empty on first run) ────────
INSERT INTO public.scraped_jobs (job_title, company, job_description, salary_range, location, url, source, status)
VALUES
  ('Senior Frontend Engineer', 'Vercel', 'We are looking for a Senior Frontend Engineer to join our growth team. You will work closely with design and backend teams to ship world-class React applications. Requirements: 5+ years React, TypeScript, performance optimisation.', '$150k–$180k', 'Remote', 'https://vercel.com/careers', 'linkedin', 'new'),
  ('Full Stack Engineer', 'Linear', 'Join the Linear team building the issue tracking tool developers love. Stack: React, TypeScript, Electron, GraphQL. You will own entire features end to end.', '$130k–$160k', 'Remote', 'https://linear.app/careers', 'linkedin', 'new'),
  ('AI Product Engineer', 'Anthropic', 'Build AI-powered developer tools and internal products. Deep knowledge of LLM APIs, streaming UIs, and evaluation pipelines required.', '$160k–$200k', 'San Francisco / Remote', 'https://anthropic.com/careers', 'indeed', 'new'),
  ('Frontend Engineer', 'Stripe', 'Work on Stripe Dashboard — the financial command centre for millions of businesses. React, TypeScript, CSS-in-JS. Obsession with performance and accessibility.', '$140k–$170k', 'Remote', 'https://stripe.com/jobs', 'linkedin', 'new'),
  ('Software Engineer – Growth', 'Supabase', 'Help grow the Supabase developer ecosystem. Work on open source tooling, SDKs, and the Supabase Studio dashboard. PostgreSQL expertise a bonus.', '$120k–$150k', 'Remote', 'https://supabase.com/careers', 'indeed', 'new')
ON CONFLICT DO NOTHING;

-- ─── Verify ──────────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
