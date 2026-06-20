ALTER TABLE public.cvs ADD CONSTRAINT cvs_user_id_title_key UNIQUE (user_id, title);
-- Drop constraint if it already exists before adding it to ensure idempotency
ALTER TABLE public.cvs DROP CONSTRAINT IF EXISTS cvs_user_id_title_key;
ALTER TABLE public.cvs ADD CONSTRAINT cvs_user_id_title_key UNIQUE (user_id, title);
